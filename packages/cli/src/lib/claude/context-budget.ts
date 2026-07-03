import type { ModelDefinition } from "@togetherlink/models";
import { type ContextTrimTelemetryInfo, sendTelemetryEvent } from "../telemetry.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import type { OpenAIMessage, TogetherApiError } from "./wire-types.js";

type ContextBudgetOptions = {
  debug?: boolean | undefined;
  /**
   * Override the context-trim alarm emitter. Production call sites leave this
   * undefined so the real always-on warning + fire-and-forget telemetry fire;
   * tests inject a spy to assert the alarm is raised (and to avoid real
   * network/install-id I/O). See TURN.md 1e.
   */
  emitContextTrimAlarm?: ((info: ContextTrimTelemetryInfo) => void) | undefined;
};

const CONTEXT_LENGTH_RETRY_FLOOR = 1;
const CONTEXT_INPUT_SAFETY_TOKENS = 4096;
const CONTEXT_OUTPUT_SAFETY_TOKENS = 512;
const CONTEXT_RETRY_TRIM_EXTRA_TOKENS = 512;
export const APPROX_CHARS_PER_TOKEN = 4;
const TRIM_PRESERVED_PREFIX_CHARS = 4096;

export function clampRequestedMaxTokens(
  maxTokens: number | undefined,
  model: ModelDefinition,
): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return maxTokens;
  }
  return Math.min(Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(maxTokens)), model.limit.output);
}

export function maxTokensForContextLengthRetry(
  error: TogetherApiError,
  model: ModelDefinition,
  currentMaxTokens: number | undefined,
): number | undefined {
  if (error.status !== 400) {
    return undefined;
  }
  const inputTokens = parseTogetherContextLengthInputTokens(error.message);
  if (inputTokens === undefined) {
    return undefined;
  }
  const rawAvailableOutputTokens = Math.min(model.limit.context - inputTokens, model.limit.output);
  if (rawAvailableOutputTokens < CONTEXT_LENGTH_RETRY_FLOOR) {
    return undefined;
  }
  const retryMaxTokens = Math.max(
    CONTEXT_LENGTH_RETRY_FLOOR,
    Math.floor(rawAvailableOutputTokens - CONTEXT_OUTPUT_SAFETY_TOKENS),
  );
  if (typeof currentMaxTokens === "number" && retryMaxTokens >= currentMaxTokens) {
    return undefined;
  }
  return retryMaxTokens;
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
  // estimation error (the calibrated ratio is good but not exact), mirroring
  // the old rough-path's /5 headroom but slightly tighter per TURN.md 1c.
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
      // 1e: a preemptive trim firing means our advertised limits / count_tokens
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
  payload.max_tokens = nextMaxTokens;
  debugLog(options, `clamped ${label} max_tokens to estimated context budget`, {
    model: payload.model,
    maxTokens: nextMaxTokens,
    requestedMaxTokens: currentMaxTokens,
    estimatedInputTokens: refinedInputTokens,
  });
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

export function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
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

export function canTrimInputForContextLengthRetry(
  error: TogetherApiError,
  model: ModelDefinition,
): boolean {
  if (error.status !== 400) {
    return false;
  }
  const inputTokens = parseTogetherContextLengthInputTokens(error.message);
  const contextTokens = parseTogetherContextLengthMaxTokens(error.message) ?? model.limit.context;
  return inputTokens !== undefined && inputTokens >= contextTokens;
}

export function parseTogetherContextLengthMaxTokens(message: string): number | undefined {
  const match = message.match(/maximum context length is\s+([\d,_]+)\s+tokens/is);
  return parseTokenCount(match?.[1]);
}

export function parseTogetherContextLengthInputTokens(message: string): number | undefined {
  const parentheticalMatch = message.match(
    /maximum context length is\s+[\d,_]+\s+tokens.*?\(([\d,_]+)\s+input\b/is,
  );
  if (parentheticalMatch) {
    return parseTokenCount(parentheticalMatch[1]);
  }
  const resolvedInputMatch = message.match(/request resolved to\s+([\d,_]+)\s+input tokens\b/is);
  return parseTokenCount(resolvedInputMatch?.[1]);
}

function parseTokenCount(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.replaceAll(/[,_]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function safeClaudeInputLimit(model: ModelDefinition): number {
  return Math.max(1, model.limit.context - CONTEXT_INPUT_SAFETY_TOKENS);
}

/**
 * Always-on alarm for a context trim firing. Writes a single non-debug-gated
 * stderr warning (every firing is a bug report against our advertised limits /
 * count_tokens accuracy — compaction is the harness's job) and fires a
 * fire-and-forget `context_trim` telemetry event. Trim arithmetic and call-site
 * semantics are untouched — only observability is added. See TURN.md 1e.
 *
 * The `options.emitContextTrimAlarm` override lets tests capture the event
 * without performing real network/install-id I/O; production leaves it unset.
 */
function reportContextTrim(options: ContextBudgetOptions, info: ContextTrimTelemetryInfo): void {
  const override = options.emitContextTrimAlarm;
  if (override) {
    override(info);
    return;
  }
  emitContextTrimAlarm(info);
}

/**
 * Public entry point for the reactive (Together context-length 400) trim path.
 * The preemptive path calls `reportContextTrim` directly with its options (so
 * the test override works); the call sites in stream.ts / chat-completions.ts
 * call this for the reactive path. Mirrors the always-on warning + telemetry.
 */
export function emitContextTrimAlarm(info: ContextTrimTelemetryInfo): void {
  process.stderr.write(
    `togetherlink: trimmed ${info.trimmedChars} chars of conversation context ` +
      `to fit <${info.model}> window (${info.path} path) — if you see this often, report it\n`,
  );
  // Fire-and-forget, best-effort, never throws: matches every other telemetry
  // call site (cli_started / session_started / session_ended). GITHUB_ACTIONS +
  // the 2s AbortController timeout inside sendTelemetryEvent guard tests/CI.
  void sendTelemetryEvent({ event: "context_trim", contextTrim: info });
}

export function trimPayloadInputForContextLengthRetry(
  payload: Record<string, unknown>,
  error: TogetherApiError,
  model: ModelDefinition,
): { trimmedChars: number } | undefined {
  const inputTokens = parseTogetherContextLengthInputTokens(error.message);
  const contextTokens = parseTogetherContextLengthMaxTokens(error.message) ?? model.limit.context;
  if (inputTokens === undefined || inputTokens < contextTokens) {
    return undefined;
  }

  const excessTokens = inputTokens - contextTokens + CONTEXT_RETRY_TRIM_EXTRA_TOKENS;
  return trimPayloadMessages(payload.messages, Math.max(1, excessTokens * APPROX_CHARS_PER_TOKEN));
}

function trimPayloadMessages(
  messages: unknown,
  requestedCharsToTrim: number,
): { trimmedChars: number } | undefined {
  if (!Array.isArray(messages) || requestedCharsToTrim <= 0) {
    return undefined;
  }
  let charsToTrim = requestedCharsToTrim;
  let trimmedChars = 0;
  for (const message of messages) {
    if (charsToTrim <= 0) {
      break;
    }
    const record = asOpenAIMessageRecord(message);
    if (
      !record ||
      record.role === "system" ||
      typeof record.content !== "string" ||
      record.content.length === 0
    ) {
      continue;
    }
    const result = trimOldContextText(record.content, charsToTrim);
    if (!result) {
      continue;
    }
    record.content = result.text;
    charsToTrim -= result.trimmedChars;
    trimmedChars += result.trimmedChars;
  }

  return trimmedChars > 0 ? { trimmedChars } : undefined;
}

function trimOldContextText(
  text: string,
  requestedChars: number,
): { text: string; trimmedChars: number } | undefined {
  const marker = "\n[togetherlink trimmed older context to fit the model window]\n";
  if (requestedChars <= 0 || text.length <= marker.length + 32) {
    return undefined;
  }
  const preservedPrefixChars = Math.min(
    TRIM_PRESERVED_PREFIX_CHARS,
    Math.max(0, text.length - marker.length - 32),
  );
  const maxRemovableChars = Math.max(1, text.length - preservedPrefixChars - marker.length - 32);
  const removableChars = Math.min(requestedChars, maxRemovableChars);
  const nextText = `${text.slice(0, preservedPrefixChars)}${marker}${text.slice(preservedPrefixChars + removableChars)}`;
  return {
    text: nextText,
    trimmedChars: Math.max(0, text.length - nextText.length),
  };
}

function asOpenAIMessageRecord(value: unknown): OpenAIMessage | undefined {
  return typeof value === "object" && value !== null ? (value as OpenAIMessage) : undefined;
}

function debugLog(
  options: ContextBudgetOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
