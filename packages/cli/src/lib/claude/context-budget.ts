import type { ModelDefinition } from "@togetherlink/models";
import { type ContextTrimTelemetryInfo } from "../telemetry.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import {
  APPROX_CHARS_PER_TOKEN,
  emitContextTrimAlarm,
  jsonByteLength,
  trimPayloadMessages,
} from "../context-fit.js";

// Re-export the shared primitives so existing importers (cost.ts,
// translate-response.ts, codex/translate-request.ts) keep their import path.
// The reactive context-fit retry now lives entirely in ../context-fit.ts and
// together-client.ts; this module keeps only the *proactive*, estimator-based
// budget that runs before each Claude request.
export { APPROX_CHARS_PER_TOKEN, jsonByteLength } from "../context-fit.js";

type ContextBudgetOptions = {
  debug?: boolean | undefined;
  claudeCodeMaxOutputTokens?: number | undefined;
  claudeCodeMaxOutputTokensUserSet?: boolean | undefined;
  isCompactionRequest?: boolean | undefined;
  /**
   * Override the context-trim alarm emitter. Production call sites leave this
   * undefined so the real always-on warning + fire-and-forget telemetry fire;
   * tests inject a spy to assert the alarm is raised (and to avoid real
   * network/install-id I/O).
   */
  emitContextTrimAlarm?: ((info: ContextTrimTelemetryInfo) => void) | undefined;
};

const CONTEXT_LENGTH_RETRY_FLOOR = 1;
const CONTEXT_INPUT_SAFETY_TOKENS = 4096;
const CONTEXT_OUTPUT_SAFETY_TOKENS = 512;
const CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 32_000;
const DEFAULT_CLAUDE_NORMAL_MAX_OUTPUT_TOKENS = 28_000;

export function clampRequestedMaxTokens(
  maxTokens: number | undefined,
  model: ModelDefinition,
): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return maxTokens;
  }
  return Math.min(Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(maxTokens)), model.limit.output);
}

export function clampClaudeClientMaxTokens(
  maxTokens: number | undefined,
  model: ModelDefinition,
  options: ContextBudgetOptions,
): number | undefined {
  const clamped = clampRequestedMaxTokens(maxTokens, model);
  if (typeof clamped !== "number" || !Number.isFinite(clamped)) {
    return clamped;
  }

  const claudeCodeMaxOutputTokens =
    finiteTokenCount(options.claudeCodeMaxOutputTokens) ?? CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS;
  const clientCap =
    options.claudeCodeMaxOutputTokensUserSet === true || options.isCompactionRequest === true
      ? claudeCodeMaxOutputTokens
      : Math.min(claudeCodeMaxOutputTokens, DEFAULT_CLAUDE_NORMAL_MAX_OUTPUT_TOKENS);
  return Math.min(clamped, clientCap);
}

export function applyEstimatedContextBudget(
  payload: Record<string, unknown>,
  model: ModelDefinition,
  options: ContextBudgetOptions,
  label: string,
  estimatedInputTokens: number,
): void {
  const currentMaxTokens = payload.max_tokens;
  if (typeof currentMaxTokens !== "number" || !Number.isFinite(currentMaxTokens)) {
    return;
  }

  // Fast path: when the estimate says we are comfortably inside the window,
  // skip the whole clamp/trim computation. This is the ~95% of turns where
  // the session is nowhere near the context window — the budget check is now
  // two comparisons. The 1.15 factor is the headroom that accounts for
  // estimation error (the calibrated ratio is good but not exact).
  const estimatedInputTokensWithHeadroom = estimatedInputTokens * 1.15;
  if (
    currentMaxTokens <= model.limit.output &&
    estimatedInputTokensWithHeadroom + currentMaxTokens + CONTEXT_OUTPUT_SAFETY_TOKENS <
      model.limit.context
  ) {
    return;
  }

  // Near the window: keep today's clamp/trim behavior exactly. The trim path
  // may re-stringify (via jsonByteLength) for its post-trim recount — this
  // path is exceptional by construction (the early-exit gate kept it cold).
  let refinedInputTokens = estimatePayloadInputTokens(payload);
  const reserveOverflowTokens =
    refinedInputTokens + currentMaxTokens + CONTEXT_OUTPUT_SAFETY_TOKENS - model.limit.context;
  if (reserveOverflowTokens > 0) {
    const trimmed = trimPayloadInputByApproxTokens(payload, reserveOverflowTokens);
    if (trimmed) {
      refinedInputTokens = estimatePayloadInputTokens(payload);
      // A preemptive trim firing means our advertised limits / count_tokens
      // let the harness compact too late — surface it loudly. The alarm is
      // always-on (not debug-gated); the debug log below stays too.
      reportContextTrim(options, {
        path: "preemptive",
        model: typeof payload.model === "string" ? payload.model : "",
        trimmedChars: trimmed.trimmedChars,
        inputTokens: estimatedInputTokens,
        contextWindow: model.limit.context,
      });
      debugLog(options, `trimmed ${label} input to reserve requested output`, {
        model: payload.model,
        trimmedChars: trimmed.trimmedChars,
        requestedMaxTokens: currentMaxTokens,
        estimatedInputTokens: refinedInputTokens,
      });
    }
  }

  const availableOutputTokens = Math.max(
    CONTEXT_LENGTH_RETRY_FLOOR,
    Math.floor(model.limit.context - refinedInputTokens - CONTEXT_OUTPUT_SAFETY_TOKENS),
  );
  const nextMaxTokens = Math.min(currentMaxTokens, model.limit.output, availableOutputTokens);
  if (nextMaxTokens >= currentMaxTokens) {
    return;
  }
  if (options.isCompactionRequest) {
    // Never turn a compaction request into a one-token response. If the cheap
    // estimator cannot free enough room, preserve the bounded summary budget
    // and let Together's exact context-length error drive the reactive
    // trim/drop ladder. That ladder can then retain Claude Code's original
    // compaction output budget.
    debugLog(options, `preserved ${label} compaction output budget for reactive context fit`, {
      model: payload.model,
      maxTokens: currentMaxTokens,
      estimatedAvailableOutputTokens: availableOutputTokens,
      estimatedInputTokens: refinedInputTokens,
    });
    return;
  }
  payload.max_tokens = nextMaxTokens;
  debugLog(options, `clamped ${label} max_tokens to estimated context budget`, {
    model: payload.model,
    maxTokens: nextMaxTokens,
    requestedMaxTokens: currentMaxTokens,
    estimatedInputTokens: refinedInputTokens,
  });
}

function finiteTokenCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(value));
}

function estimatePayloadInputTokens(payload: Record<string, unknown>): number {
  return Math.max(
    1,
    Math.ceil(
      jsonByteLength({
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: payload.tool_choice,
      }) / APPROX_CHARS_PER_TOKEN,
    ),
  );
}

export function trimPayloadInputByApproxTokens(
  payload: Record<string, unknown>,
  tokensToTrim: number,
): { trimmedChars: number } | undefined {
  if (tokensToTrim <= 0) {
    return undefined;
  }
  return trimPayloadMessages(
    payload.messages,
    Math.max(1, Math.ceil(tokensToTrim * APPROX_CHARS_PER_TOKEN)),
  );
}

export function safeClaudeInputLimit(model: ModelDefinition): number {
  return Math.max(1, model.limit.context - CONTEXT_INPUT_SAFETY_TOKENS);
}

/**
 * Emit the always-on preemptive-trim alarm, honoring a test override. Delegates
 * to the shared `emitContextTrimAlarm` in production.
 */
function reportContextTrim(options: ContextBudgetOptions, info: ContextTrimTelemetryInfo): void {
  const override = options.emitContextTrimAlarm;
  if (override) {
    override(info);
    return;
  }
  emitContextTrimAlarm(info);
}

function debugLog(
  options: ContextBudgetOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
