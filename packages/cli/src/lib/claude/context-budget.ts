import type { ModelDefinition } from "@togetherlink/models";
import { writeProxyDebugLog } from "../proxy-debug.js";
import type { OpenAIMessage, TogetherApiError } from "./wire-types.js";

type ContextBudgetOptions = {
  debug?: boolean | undefined;
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
): void {
  const currentMaxTokens = payload.max_tokens;
  if (typeof currentMaxTokens !== "number" || !Number.isFinite(currentMaxTokens)) {
    return;
  }
  const roughInputTokens = roughPayloadInputTokens(payload);
  if (roughInputTokens !== undefined) {
    const roughInputTokensWithHeadroom = roughInputTokens + Math.ceil(roughInputTokens / 5);
    if (
      currentMaxTokens <= model.limit.output &&
      roughInputTokensWithHeadroom + currentMaxTokens + CONTEXT_OUTPUT_SAFETY_TOKENS <
        model.limit.context
    ) {
      return;
    }
  }

  let estimatedInputTokens = estimatePayloadInputTokens(payload);
  const reserveOverflowTokens =
    estimatedInputTokens + currentMaxTokens + CONTEXT_OUTPUT_SAFETY_TOKENS - model.limit.context;
  if (reserveOverflowTokens > 0) {
    const trimmed = trimPayloadInputByApproxTokens(payload, reserveOverflowTokens);
    if (trimmed) {
      estimatedInputTokens = estimatePayloadInputTokens(payload);
      debugLog(options, `trimmed ${label} input to reserve requested output`, {
        model: payload.model,
        trimmedChars: trimmed.trimmedChars,
        requestedMaxTokens: currentMaxTokens,
        estimatedInputTokens,
      });
    }
  }

  const availableOutputTokens = Math.max(
    CONTEXT_LENGTH_RETRY_FLOOR,
    Math.floor(model.limit.context - estimatedInputTokens - CONTEXT_OUTPUT_SAFETY_TOKENS),
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
    estimatedInputTokens,
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

function roughPayloadInputTokens(payload: Record<string, unknown>): number | undefined {
  if (payload.tools !== undefined || payload.tool_choice !== undefined) {
    return undefined;
  }
  const messages = payload.messages;
  if (!Array.isArray(messages)) {
    return undefined;
  }
  let chars = 0;
  for (const message of messages) {
    if (typeof message !== "object" || message === null) {
      return undefined;
    }
    const record = message as Record<string, unknown>;
    if (typeof record.role !== "string" || typeof record.content !== "string") {
      return undefined;
    }
    chars += record.role.length + record.content.length + 32;
  }
  return Math.max(1, Math.ceil(chars / APPROX_CHARS_PER_TOKEN));
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
