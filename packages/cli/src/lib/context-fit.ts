import type { ModelDefinition } from "@togetherlink/models";
import { type ContextTrimTelemetryInfo, sendTelemetryEvent } from "./telemetry.js";

/**
 * Shared, wire-uniform reactive context-fit for the Together client.
 *
 * Every proxied request (Claude + Codex, stream + non-stream) funnels through
 * `together-client.ts` as an OpenAI chat-completions payload. When Together
 * rejects it with `context_length_exceeded`, the client repeatedly calls
 * `applyContextFit` to mutate the payload and retries until it fits — using
 * Together's *actual* reported input-token count each time (not an estimate),
 * so the loop is self-correcting and convergent.
 *
 * The proactive, estimator-based budget stays in `claude/context-budget.ts`;
 * this module is the reactive safety net that both harnesses reuse. See the
 * plan in `.claude/plans` for the full design.
 */

export const APPROX_CHARS_PER_TOKEN = 4;

const CONTEXT_LENGTH_RETRY_FLOOR = 1;
const CONTEXT_OUTPUT_SAFETY_TOKENS = 512;
const CONTEXT_RETRY_TRIM_EXTRA_TOKENS = 512;
const TRIM_PRESERVED_PREFIX_CHARS = 4096;
/** Minimum output room worth preserving before we start trimming input. */
const MIN_USEFUL_OUTPUT_TOKENS = 512;
const MIN_PREFERRED_OUTPUT_TOKENS = 8000;
/** Fraction of the original conversation whose loss triggers the loud alarm. */
const HARD_WARN_DROPPED_FRACTION = 0.5;
/** Upper bound on fit retries per request; the ladder converges well under this. */
export const CONTEXT_FIT_MAX_ATTEMPTS = 6;

const IMAGE_REMOVED_PLACEHOLDER = "[togetherlink removed an older image to fit the model window]";
const TRIM_MARKER = "\n[togetherlink trimmed older context to fit the model window]\n";

/** Structural view of an OpenAI chat message — harness-agnostic on purpose. */
type FitContentPart = { type?: string; text?: string; image_url?: unknown };
type FitMessage = {
  role?: string;
  content?: string | FitContentPart[] | null;
  tool_call_id?: string;
  tool_calls?: unknown[];
};

export function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

// --------------------------------------------------------------------------
// Parsing Together's context-length error
// --------------------------------------------------------------------------

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

export type ContextOverflow = { inputTokens: number; contextTokens: number };

/**
 * Recognize a Together context-length rejection and extract the real input and
 * context token counts. Returns undefined for any 400 that is NOT a
 * context-length overflow (e.g. template errors), so the caller can pass those
 * through untouched.
 */
export function contextLengthOverflow(
  message: string,
  model: ModelDefinition,
): ContextOverflow | undefined {
  const inputTokens = parseTogetherContextLengthInputTokens(message);
  if (inputTokens === undefined) {
    return undefined;
  }
  const contextTokens = parseTogetherContextLengthMaxTokens(message) ?? model.limit.context;
  return { inputTokens, contextTokens };
}

// --------------------------------------------------------------------------
// Trimming rungs
// --------------------------------------------------------------------------

/**
 * Trim `requestedCharsToTrim` characters of old conversation text across the
 * messages. Handles both plain-string content and OpenAI array content
 * (`[{type:"text",text}, ...]`) — the array case is where a coding session's
 * tool-result and multimodal tokens actually live. System messages are never
 * trimmed. Returns the number of chars actually removed, or undefined.
 */
export function trimPayloadMessages(
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
    const record = asFitMessage(message);
    if (!record || record.role === "system") {
      continue;
    }
    const result = trimMessageContent(record, charsToTrim);
    if (!result) {
      continue;
    }
    charsToTrim -= result.trimmedChars;
    trimmedChars += result.trimmedChars;
  }
  return trimmedChars > 0 ? { trimmedChars } : undefined;
}

function trimMessageContent(
  record: FitMessage,
  charsToTrim: number,
): { trimmedChars: number } | undefined {
  if (typeof record.content === "string" && record.content.length > 0) {
    const result = trimOldContextText(record.content, charsToTrim);
    if (!result) {
      return undefined;
    }
    record.content = result.text;
    return { trimmedChars: result.trimmedChars };
  }
  if (Array.isArray(record.content)) {
    let remaining = charsToTrim;
    let trimmed = 0;
    for (const part of record.content) {
      if (remaining <= 0) {
        break;
      }
      if (
        part &&
        typeof part === "object" &&
        part.type === "text" &&
        typeof part.text === "string"
      ) {
        const result = trimOldContextText(part.text, remaining);
        if (!result) {
          continue;
        }
        part.text = result.text;
        remaining -= result.trimmedChars;
        trimmed += result.trimmedChars;
      }
    }
    return trimmed > 0 ? { trimmedChars: trimmed } : undefined;
  }
  return undefined;
}

function trimOldContextText(
  text: string,
  requestedChars: number,
): { text: string; trimmedChars: number } | undefined {
  if (requestedChars <= 0 || text.length <= TRIM_MARKER.length + 32) {
    return undefined;
  }
  const preservedPrefixChars = Math.min(
    TRIM_PRESERVED_PREFIX_CHARS,
    Math.max(0, text.length - TRIM_MARKER.length - 32),
  );
  const maxRemovableChars = Math.max(
    1,
    text.length - preservedPrefixChars - TRIM_MARKER.length - 32,
  );
  const removableChars = Math.min(requestedChars, maxRemovableChars);
  const nextText = `${text.slice(0, preservedPrefixChars)}${TRIM_MARKER}${text.slice(
    preservedPrefixChars + removableChars,
  )}`;
  return {
    text: nextText,
    trimmedChars: Math.max(0, text.length - nextText.length),
  };
}

/**
 * Replace all but the most-recent `keepMostRecent` image parts with a short
 * text placeholder. Images (Codex Computer-Use screenshots, pasted images) are
 * vision-expanded by Together into far more tokens than their JSON bytes
 * suggest, so stripping stale ones frees the most context for the least
 * information loss. The freed-char count understates the real token savings —
 * that's fine, the client re-reads Together's true count on the next attempt.
 */
export function stripOldImages(
  messages: unknown,
  keepMostRecent = 1,
): { removedParts: number; freedChars: number } | undefined {
  if (!Array.isArray(messages)) {
    return undefined;
  }
  const locations: Array<{ parts: FitContentPart[]; index: number }> = [];
  for (const message of messages) {
    const record = asFitMessage(message);
    if (!record || !Array.isArray(record.content)) {
      continue;
    }
    record.content.forEach((part, index) => {
      if (isImagePart(part)) {
        locations.push({ parts: record.content as FitContentPart[], index });
      }
    });
  }
  if (locations.length <= keepMostRecent) {
    return undefined;
  }
  const toRemove = locations.slice(0, locations.length - keepMostRecent);
  let removedParts = 0;
  let freedChars = 0;
  for (const location of toRemove) {
    const before = jsonByteLength(location.parts[location.index]);
    location.parts[location.index] = { type: "text", text: IMAGE_REMOVED_PLACEHOLDER };
    const after = jsonByteLength(location.parts[location.index]);
    freedChars += Math.max(0, before - after);
    removedParts += 1;
  }
  return removedParts > 0 ? { removedParts, freedChars } : undefined;
}

function isImagePart(part: unknown): part is FitContentPart {
  if (!part || typeof part !== "object") {
    return false;
  }
  const record = part as FitContentPart;
  return (
    record.type === "image_url" || record.type === "input_image" || record.image_url !== undefined
  );
}

/**
 * Drop the oldest whole conversation turns until at least `charsToFree` bytes
 * are removed. Segments messages into turns at each `user` boundary and removes
 * whole turns from the front, so a tool-call assistant message is never
 * orphaned from its matching `role:"tool"` results. Always preserves leading
 * system messages and the latest user turn (and everything after it).
 */
export function dropOldestTurns(
  messages: unknown,
  charsToFree: number,
): { droppedMessages: number; freedChars: number } | undefined {
  if (!Array.isArray(messages) || charsToFree <= 0) {
    return undefined;
  }
  let start = 0;
  while (start < messages.length && asFitMessage(messages[start])?.role === "system") {
    start += 1;
  }
  const boundaries: number[] = [];
  for (let i = start; i < messages.length; i += 1) {
    if (asFitMessage(messages[i])?.role === "user") {
      boundaries.push(i);
    }
  }
  // Need at least two user turns to have something safe to drop: we always keep
  // the last one (and everything after it).
  if (boundaries.length <= 1) {
    return undefined;
  }
  let freedChars = 0;
  let dropUpTo = start;
  for (let k = 0; k < boundaries.length - 1; k += 1) {
    if (freedChars >= charsToFree) {
      break;
    }
    const blockEnd = boundaries[k + 1] as number;
    for (let i = dropUpTo; i < blockEnd; i += 1) {
      freedChars += jsonByteLength(messages[i]);
    }
    dropUpTo = blockEnd;
  }
  const droppedMessages = dropUpTo - start;
  if (droppedMessages <= 0) {
    return undefined;
  }
  (messages as unknown[]).splice(start, droppedMessages);
  return { droppedMessages, freedChars };
}

// --------------------------------------------------------------------------
// Orchestrator
// --------------------------------------------------------------------------

export type ContextFitState = {
  originalChars: number;
  freedChars: number;
  originalMaxTokens?: number;
};

export type ContextFitOutcome = {
  mutated: boolean;
  action?: ContextTrimTelemetryInfo["action"];
  freedChars: number;
  inputTokens: number;
  contextWindow: number;
  hard: boolean;
};

export function newContextFitState(payload: Record<string, unknown>): ContextFitState {
  const originalMaxTokens =
    typeof payload.max_tokens === "number" && Number.isFinite(payload.max_tokens)
      ? Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(payload.max_tokens))
      : undefined;
  return {
    originalChars: jsonByteLength(payload.messages ?? []),
    freedChars: 0,
    ...(originalMaxTokens !== undefined ? { originalMaxTokens } : {}),
  };
}

/**
 * Apply the single highest-value fit rung available for this overflow and
 * mutate `payload` in place. One rung per call; the client re-posts and calls
 * again with Together's fresh count, so the ladder escalates across attempts:
 *   1. reduce max_tokens   (input fits, only output too big — zero context loss)
 *   2. strip old images    (huge tokens freed, minimal information loss)
 *   3. trim old text        (string + array content)
 *   4. drop oldest turns    (pairing-aware guaranteed fit)
 * Returns `mutated:false` only when nothing further can be freed (floor).
 */
export function applyContextFit(
  payload: Record<string, unknown>,
  message: string,
  model: ModelDefinition,
  state: ContextFitState,
): ContextFitOutcome {
  const overflow = contextLengthOverflow(message, model);
  if (!overflow) {
    return {
      mutated: false,
      freedChars: 0,
      inputTokens: 0,
      contextWindow: model.limit.context,
      hard: false,
    };
  }
  const { inputTokens, contextTokens } = overflow;
  const base = { inputTokens, contextWindow: contextTokens };

  // Rung 1: input alone fits — the request is over only because of the
  // requested output. Clamp max_tokens and keep every token of context.
  const availableOutput = contextTokens - inputTokens - CONTEXT_OUTPUT_SAFETY_TOKENS;
  const currentMaxTokens = typeof payload.max_tokens === "number" ? payload.max_tokens : undefined;
  const desiredMaxTokens = Math.min(
    state.originalMaxTokens ?? currentMaxTokens ?? model.limit.output,
    model.limit.output,
  );
  const minPreferredOutput = Math.min(desiredMaxTokens, MIN_PREFERRED_OUTPUT_TOKENS);
  if (availableOutput >= minPreferredOutput) {
    const nextMaxTokens = Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(availableOutput));
    if (currentMaxTokens === undefined || nextMaxTokens < currentMaxTokens) {
      payload.max_tokens = nextMaxTokens;
      return { mutated: true, action: "max_tokens", freedChars: 0, hard: false, ...base };
    }
  }

  // Keep enough output room for agent turns; repeated 512-token retries can make
  // Claude Code report a false "max output tokens" API error.
  if (currentMaxTokens !== desiredMaxTokens) {
    payload.max_tokens = desiredMaxTokens;
  }
  const targetInputTokens = contextTokens - desiredMaxTokens - CONTEXT_OUTPUT_SAFETY_TOKENS;
  const tokensToFree =
    Math.max(1, inputTokens - targetInputTokens) + CONTEXT_RETRY_TRIM_EXTRA_TOKENS;
  const payloadBytes = jsonByteLength({
    messages: payload.messages,
    tools: payload.tools,
    tool_choice: payload.tool_choice,
  });
  const realCharsPerToken = Math.max(1, payloadBytes / Math.max(1, inputTokens));
  const charsToFree = Math.max(1, Math.ceil(tokensToFree * realCharsPerToken));

  // Rung 2: strip old images (keep the most recent one).
  const stripped = stripOldImages(payload.messages, 1);
  if (stripped) {
    return finish(state, base, "strip_images", stripped.freedChars);
  }
  // Rung 3: trim old text.
  const trimmed = trimPayloadMessages(payload.messages, charsToFree);
  if (trimmed) {
    return finish(state, base, "trim_text", trimmed.trimmedChars);
  }
  // Rung 4: drop oldest whole turns.
  const dropped = dropOldestTurns(payload.messages, charsToFree);
  if (dropped) {
    return finish(state, base, "drop_turns", dropped.freedChars);
  }
  // Floor: only system + latest user turn remain and it still doesn't fit.
  return { mutated: false, freedChars: 0, hard: false, ...base };
}

function finish(
  state: ContextFitState,
  base: { inputTokens: number; contextWindow: number },
  action: NonNullable<ContextTrimTelemetryInfo["action"]>,
  freedChars: number,
): ContextFitOutcome {
  state.freedChars += freedChars;
  const hard =
    state.originalChars > 0 && state.freedChars / state.originalChars > HARD_WARN_DROPPED_FRACTION;
  return { mutated: true, action, freedChars, hard, ...base };
}

// --------------------------------------------------------------------------
// Telemetry alarm (always-on)
// --------------------------------------------------------------------------

/**
 * Always-on alarm for a reactive context trim. Writes a single non-debug-gated
 * stderr warning and fires a fire-and-forget `context_trim` telemetry event.
 * Every firing is a bug report against our advertised limits / count_tokens
 * accuracy — compaction is the harness's job. `hard` firings (a large fraction
 * of the conversation discarded) get a louder line.
 */
export function emitContextTrimAlarm(info: ContextTrimTelemetryInfo): void {
  const severity = info.hard ? "DROPPED A LARGE PORTION of" : "trimmed";
  process.stderr.write(
    `togetherlink: ${severity} ${info.trimmedChars} chars of conversation context ` +
      `to fit <${info.model}> window (${info.path} path${info.action ? `, ${info.action}` : ""}) ` +
      `— if you see this often, report it\n`,
  );
  void sendTelemetryEvent({ event: "context_trim", contextTrim: info });
}

function asFitMessage(value: unknown): FitMessage | undefined {
  return typeof value === "object" && value !== null ? (value as FitMessage) : undefined;
}
