import { type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync } from "node:fs";
import { TOGETHER_BASE_URL } from "../together-core.js";
import { CLAUDE_SUPPORTED_MODELS } from "./defaults.js";
import { GLM_5_2, type ModelDefinition } from "@togetherlink/models";
import { CostTracker } from "./cost.js";
import {
  describeImage,
  imageBlockKey,
  isImageBlock,
  isUrlImageBlock,
  type ImageBlock,
  type UrlBlock,
} from "./vision.js";
import { stableHash, stableStringify } from "../stable-hash.js";

// Re-exported so the daemon's agent-agnostic session model (daemon/state.ts)
// can reference the model type without depending on @togetherlink/models directly.
export type { ModelDefinition };

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "server_tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: unknown; is_error?: boolean }
  | { type: "web_search_tool_result"; tool_use_id?: string; content?: unknown; error_code?: string }
  | {
      type: "web_search_tool_result_error";
      tool_use_id?: string;
      content?: unknown;
      error_code?: string;
    }
  | { type: "image"; source: { type: string; media_type?: string; data?: string; url?: string } }
  | { type: "url"; url: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicMessagesRequest = {
  model?: string;
  max_tokens?: number;
  stop_sequences?: string[];
  temperature?: number;
  stream?: boolean;
  system?: string | AnthropicContentBlock[];
  messages?: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: unknown;
  thinking?: { type?: string; budget_tokens?: number; effort?: unknown };
  effort?: unknown;
  reasoning_effort?: unknown;
};

type AnthropicCountTokensRequest = Pick<
  AnthropicMessagesRequest,
  "model" | "system" | "messages" | "tools" | "tool_choice"
>;

type AnthropicTool = {
  name?: string;
  description?: string;
  input_schema?: unknown;
  type?: string;
  [key: string]: unknown;
};

type NativeServerTool = {
  kind: "web_search";
  name: string;
  definition: AnthropicTool;
};

type OpenAITool = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  reasoning?: string;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type OpenAIChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
};

type ResolvedClaudeModel = {
  alias: string;
  definition: ModelDefinition;
};

/**
 * Together upstream error, normalized. Carries the real HTTP status and a
 * best-effort message/code pulled from Together's `error` object, plus the
 * Anthropic error type/status we map it to (so the caller can render an honest
 * Anthropic-shaped error instead of flattening everything to 500).
 *
 * `retryable` is true for transient faults (429, 503, overloaded) — fetchTogether
 * retries those before throwing. Everything else is thrown on the first hit.
 */
type TogetherApiError = {
  status: number;
  anthropicStatus: number;
  anthropicType: string;
  message: string;
  code?: string | undefined;
  retryAfterMs?: number | undefined;
  retryable: boolean;
};

type TogetherFetchResult =
  | { ok: true; json: OpenAIChatResponse; error?: undefined }
  | { ok: false; error: TogetherApiError; json?: undefined };

type StreamProxyResult =
  | { ok: true; status?: number }
  | { ok: false; status: number; error: string };

// Transient upstream faults worth retrying with backoff. 429 = rate limited;
// 503/overloaded = server-side temporary capacity. Everything else (401, 400,
// 402, 404, 5xx other than 503) is non-retryable — retrying a bad key or a
// malformed request just delays the same failure.
const RETRYABLE_STATUSES = new Set([429, 503]);
const RETRYABLE_ERROR_CODES = new Set(["overloaded", "service_unavailable"]);
const MAX_RETRIES = 3;
const CONTEXT_LENGTH_RETRY_FLOOR = 1;
const CONTEXT_INPUT_SAFETY_TOKENS = 4096;
const CONTEXT_OUTPUT_SAFETY_TOKENS = 512;
const CONTEXT_RETRY_TRIM_EXTRA_TOKENS = 512;
const APPROX_CHARS_PER_TOKEN = 4;
const TRIM_PRESERVED_PREFIX_CHARS = 4096;
const TOGETHERLINK_IDENTITY_PROMPT =
  "You are a Together AI model routed through togetherlink, not Anthropic Claude.";

function clampRequestedMaxTokens(
  maxTokens: number | undefined,
  model: ModelDefinition,
): number | undefined {
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens)) {
    return maxTokens;
  }
  return Math.min(Math.max(CONTEXT_LENGTH_RETRY_FLOOR, Math.floor(maxTokens)), model.limit.output);
}

function maxTokensForContextLengthRetry(
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

function applyEstimatedContextBudget(
  payload: Record<string, unknown>,
  model: ModelDefinition,
  options: ClaudeProxyOptions,
  label: string,
): void {
  const currentMaxTokens = payload.max_tokens;
  if (typeof currentMaxTokens !== "number" || !Number.isFinite(currentMaxTokens)) {
    return;
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
      byteLength({
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: payload.tool_choice,
      }) / APPROX_CHARS_PER_TOKEN,
    ),
  );
}

function trimPayloadInputByApproxTokens(
  payload: Record<string, unknown>,
  tokensToTrim: number,
): { trimmedChars: number } | undefined {
  const messages = payload.messages;
  if (!Array.isArray(messages) || tokensToTrim <= 0) {
    return undefined;
  }
  let charsToTrim = Math.max(1, Math.ceil(tokensToTrim * APPROX_CHARS_PER_TOKEN));
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

function canTrimInputForContextLengthRetry(
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

function parseTogetherContextLengthMaxTokens(message: string): number | undefined {
  const match = message.match(/maximum context length is\s+([\d,_]+)\s+tokens/is);
  return parseTokenCount(match?.[1]);
}

function parseTogetherContextLengthInputTokens(message: string): number | undefined {
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

function safeClaudeInputLimit(model: ModelDefinition): number {
  return Math.max(1, model.limit.context - CONTEXT_INPUT_SAFETY_TOKENS);
}

type ExaSearchResult = {
  title?: string;
  url?: string;
  text?: string;
  author?: string;
  publishedDate?: string;
  score?: number;
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
  autopromptString?: string;
};

export type ClaudeProxyOptions = {
  apiKey: string;
  /** Claude-facing model alias, e.g. together-glm-5-2. */
  modelId: string;
  /** Together API model id, e.g. zai-org/GLM-5.2. */
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  authToken: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
};

/**
 * Handle one claude-facing `/v1/*` (or health/models) request against a single
 * session's options. The shared daemon resolves the session from the request's
 * Bearer/x-api-key token, then calls this with that session's `options`. There
 * is no in-process per-session server anymore — the daemon owns the single
 * `http.Server` (see daemon/server.ts), so this handler is the only proxy
 * entrypoint.
 */
export async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: ClaudeProxyOptions,
): Promise<void> {
  const path = requestPath(req);
  debugLog(options, "http request", { method: req.method, url: req.url, path });

  if (req.method === "HEAD" && path === "/") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (!isAuthorized(req, options.authToken)) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }

  if (req.method === "GET" && path === "/v1/models") {
    // Claude Code's model discovery (CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY)
    // reads `max_input_tokens` as the context window and `max_tokens` as the
    // output cap per model object (since Mar 2026 — there is no `context_window`
    // field). Without these, Claude Code falls back to a ~200K default and
    // auto-compacts earlier than the selected model's true window, and the
    // context indicator shows the wrong "% used". Advertise the real limits so
    // compaction triggers at the right point.
    writeJson(res, 200, {
      data: CLAUDE_SUPPORTED_MODELS.map(claudeModelResponse),
    });
    return;
  }

  if (req.method === "GET" && path.startsWith("/v1/models/")) {
    const modelId = decodeURIComponent(path.slice("/v1/models/".length));
    const model = findClaudeModel(modelId, options);
    if (!model) {
      writeAnthropicError(res, 404, "not_found_error", `Unknown model "${modelId}".`);
      return;
    }
    writeJson(res, 200, claudeModelResponse(model));
    return;
  }

  if (req.method === "POST" && path === "/v1/messages/count_tokens") {
    const body = (await readJsonBody(req)) as Partial<AnthropicCountTokensRequest>;
    if (!body || typeof body !== "object") {
      writeAnthropicError(res, 400, "invalid_request_error", "Request body must be an object.");
      return;
    }
    if (!body.model) {
      writeAnthropicError(res, 400, "invalid_request_error", "model is required.");
      return;
    }
    if (!Array.isArray(body.messages)) {
      writeAnthropicError(res, 400, "invalid_request_error", "messages must be an array.");
      return;
    }
    writeJson(res, 200, countTokensResponse(body as AnthropicCountTokensRequest, options));
    return;
  }

  if (req.method !== "POST" || path !== "/v1/messages") {
    writeAnthropicError(
      res,
      404,
      "not_found_error",
      `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim(),
    );
    return;
  }

  const body = (await readJsonBody(req)) as AnthropicMessagesRequest;
  const upstreamAbort = new AbortController();
  const markClientDisconnected = () => {
    upstreamAbort.abort();
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  options.costTracker?.beginRequest();
  debugLog(options, "anthropic request", {
    model: body.model,
    stream: body.stream,
    messageCount: body.messages?.length ?? 0,
    toolCount: body.tools?.length ?? 0,
    tools: summarizeAnthropicTools(body.tools),
  });
  const imageBlocks = extractImageBlocks(body);
  if (imageBlocks.length > 0) {
    debugLog(options, "image blocks detected", imageBlocks);
  }
  // GLM-5.2 can't see images: describe each image/url block with a vision model
  // and replace it with a text block, so GLM reasons over the description.
  await resolveImageBlocks(body, options);
  if (body.stream) {
    await streamAnthropicFromTogether(res, body, options, upstreamAbort.signal);
    const delta = options.costTracker?.requestDelta;
    const totals = options.costTracker?.totals;
    if (options.debug && delta && totals) {
      debugLog(options, "request cost", {
        requestCostUsd: Number(delta.costUsd.toFixed(6)),
        requestInputTokens: delta.promptTokens,
        requestCachedTokens: delta.cachedTokens,
        requestOutputTokens: delta.completionTokens,
        sessionTotalCostUsd: Number(totals.costUsd.toFixed(6)),
      });
    }
    return;
  }

  const openAiResponse = await callTogetherChatCompletions(body, options, upstreamAbort.signal);
  const anthropicMessage = toAnthropicMessage(openAiResponse, body.model ?? options.modelId);

  const delta = options.costTracker?.requestDelta;
  const totals = options.costTracker?.totals;
  if (options.debug && delta && totals) {
    debugLog(options, "request cost", {
      requestCostUsd: Number(delta.costUsd.toFixed(6)),
      requestInputTokens: delta.promptTokens,
      requestCachedTokens: delta.cachedTokens,
      requestOutputTokens: delta.completionTokens,
      sessionTotalCostUsd: Number(totals.costUsd.toFixed(6)),
    });
  }

  writeJson(res, 200, anthropicMessage);
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(stableStringify(value), "utf8");
}

function trimPayloadInputForContextLengthRetry(
  payload: Record<string, unknown>,
  error: TogetherApiError,
  model: ModelDefinition,
): { trimmedChars: number } | undefined {
  const messages = payload.messages;
  if (!Array.isArray(messages)) {
    return undefined;
  }
  const inputTokens = parseTogetherContextLengthInputTokens(error.message);
  const contextTokens = parseTogetherContextLengthMaxTokens(error.message) ?? model.limit.context;
  if (inputTokens === undefined || inputTokens < contextTokens) {
    return undefined;
  }

  const excessTokens = inputTokens - contextTokens + CONTEXT_RETRY_TRIM_EXTRA_TOKENS;
  let charsToTrim = Math.max(1, excessTokens * APPROX_CHARS_PER_TOKEN);
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

function thinkingSignature(reasoning: string): string {
  return `togetherlink:${stableHash(reasoning)}`;
}

function asOpenAIMessageRecord(value: unknown): OpenAIMessage | undefined {
  return typeof value === "object" && value !== null ? (value as OpenAIMessage) : undefined;
}

/**
 * Pull the presented auth token from a request — the `Bearer` value of the
 * Authorization header, or the `x-api-key` header. The shared daemon uses this
 * as the session key: each `togetherlink claude` run mints a random token,
 * registers it with the daemon, and spawns claude with that token, so the
 * daemon can resolve incoming `/v1/*` requests to the owning session (and its
 * CostTracker) without any other routing signal.
 */
export function extractToken(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  const apiKey = req.headers["x-api-key"];
  return typeof apiKey === "string" ? apiKey : undefined;
}

/** Constant-time token match against the request's presented token. */
function isAuthorized(req: IncomingMessage, authToken: string): boolean {
  const token = extractToken(req);
  return token !== undefined && constantTimeEqual(token, authToken);
}

function constantTimeEqual(actual: string | undefined, expected: string): boolean {
  if (typeof actual !== "string") {
    return false;
  }
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(actualBytes, expectedBytes);
}

async function callTogetherChatCompletions(
  body: AnthropicMessagesRequest,
  options: ClaudeProxyOptions,
  signal?: AbortSignal,
): Promise<OpenAIChatResponse> {
  const targetModel = resolveTargetModel(body.model, options);
  const nativeTools = nativeServerTools(body.tools);
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map<string, number>();
  const messages = toOpenAIMessages(body, targetModel.definition);
  const tools = toOpenAITools(body.tools, options);

  for (let turn = 0; turn < 5; turn += 1) {
    const reasoningEffort = togetherReasoningEffort(body, targetModel.definition);
    let maxTokens = clampRequestedMaxTokens(body.max_tokens, targetModel.definition);
    const payload = {
      model: targetModel.definition.id,
      messages:
        turn === 0 && nativeTools.length > 0
          ? withNativeToolSystemPrompt(messages, nativeTools)
          : messages,
      max_tokens: maxTokens,
      stop: body.stop_sequences,
      temperature: body.temperature,
      tools,
      tool_choice: toOpenAIToolChoice(body.tool_choice),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      chat_template_kwargs: { clear_thinking: false },
      stream: false,
    };
    applyEstimatedContextBudget(payload, targetModel.definition, options, "request");
    maxTokens = typeof payload.max_tokens === "number" ? payload.max_tokens : maxTokens;
    debugLog(options, "together request", {
      model: payload.model,
      messageCount: payload.messages.length,
      toolCount: payload.tools?.length ?? 0,
      maxTokens: payload.max_tokens,
      reasoningEffort,
      nativeToolCount: nativeTools.length,
      turn,
    });
    let response = await fetchTogether(payload, options, signal);
    if (!response.ok) {
      const initialError = response.error;
      const retryMaxTokens = maxTokensForContextLengthRetry(
        initialError,
        targetModel.definition,
        maxTokens,
      );
      if (retryMaxTokens !== undefined) {
        maxTokens = retryMaxTokens;
        payload.max_tokens = maxTokens;
        debugLog(options, "retrying together request with reduced max_tokens", {
          model: payload.model,
          maxTokens,
          originalError: initialError.message,
          turn,
        });
        response = await fetchTogether(payload, options, signal);
      } else if (canTrimInputForContextLengthRetry(initialError, targetModel.definition)) {
        const trimmed = trimPayloadInputForContextLengthRetry(
          payload,
          initialError,
          targetModel.definition,
        );
        if (trimmed) {
          debugLog(options, "retrying together request with trimmed input context", {
            model: payload.model,
            trimmedChars: trimmed.trimmedChars,
            originalError: initialError.message,
            turn,
          });
          response = await fetchTogether(payload, options, signal);
        }
      }
    }

    if (!response.ok) {
      // Surfaced via fetchTogether as a TogetherApiError after exhausting retries
      // for transient faults (429/overloaded). Non-retryable, or retries
      // exhausted — map to the matching Anthropic error shape and stop.
      throw response.error;
    }
    const json = response.json;
    const usage = json.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? usage?.cached_tokens ?? 0;
    const incrementalCost =
      options.costTracker?.addUsage(
        promptTokens,
        cachedTokens,
        completionTokens,
        targetModel.definition,
      ) ?? 0;
    debugLog(options, "together response", {
      id: json.id,
      choices: json.choices?.length ?? 0,
      finishReason: json.choices?.[0]?.finish_reason,
      usage: { promptTokens, completionTokens, cachedTokens },
      incrementalCostUsd: Number(incrementalCost.toFixed(6)),
      toolCalls: json.choices?.[0]?.message?.tool_calls?.map((toolCall) => ({
        name: toolCall.function?.name,
        argumentsPreview: toolCall.function?.arguments?.slice(0, 300),
      })),
    });

    const toolCalls = json.choices?.[0]?.message?.tool_calls ?? [];
    const nativeToolCalls = toolCalls.filter((toolCall) =>
      nativeToolNames.has(toolCall.function?.name ?? ""),
    );
    if (nativeToolCalls.length === 0) {
      return json;
    }

    const reasoning =
      json.choices?.[0]?.message?.reasoning ?? json.choices?.[0]?.message?.reasoning_content;
    messages.push({
      role: "assistant",
      content: json.choices?.[0]?.message?.content ?? null,
      ...(reasoning ? { reasoning_content: reasoning } : {}),
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}",
        },
      })),
    });

    for (const toolCall of nativeToolCalls) {
      const id = toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`;
      const name = toolCall.function?.name ?? "web_search";
      const nativeTool = nativeTools.find((tool) => tool.name === name);
      const input = parseJsonOrEmpty(toolCall.function?.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const maxUses = nativeTool ? nativeToolMaxUses(nativeTool.definition) : 0;
      let result: string;
      if (priorUses >= maxUses) {
        result = `Web search error: max_uses_exceeded for ${name}. Do not call this tool again; answer from the results already provided or say search is unavailable.`;
      } else if (nativeTool?.kind === "web_search") {
        nativeToolUses.set(name, priorUses + 1);
        result = await runExaSearch(input, nativeTool.definition, options);
      } else {
        result = "Unsupported native server tool.";
      }
      messages.push({ role: "tool", tool_call_id: id, content: result });
    }
  }

  return {
    id: `msg_${randomUUID().replaceAll("-", "")}`,
    choices: [
      {
        finish_reason: "stop",
        message: {
          content:
            "I could not complete the native web search because the model kept requesting additional search tool calls.",
        },
      },
    ],
  };
}

function resolveTargetModel(
  requestedModel: string | undefined,
  options: ClaudeProxyOptions,
): ResolvedClaudeModel {
  const supported = CLAUDE_SUPPORTED_MODELS.find(
    (model) => model.alias === requestedModel || model.definition.id === requestedModel,
  );
  return supported ?? { alias: options.modelId, definition: options.modelDefinition };
}

function findClaudeModel(
  modelId: string,
  options: ClaudeProxyOptions,
): ResolvedClaudeModel | undefined {
  const supported = CLAUDE_SUPPORTED_MODELS.find(
    (model) => model.alias === modelId || model.definition.id === modelId,
  );
  if (supported) {
    return supported;
  }
  if (modelId === options.modelId || modelId === options.targetModelId) {
    return { alias: options.modelId, definition: options.modelDefinition };
  }
  return undefined;
}

function claudeModelResponse(model: ResolvedClaudeModel): Record<string, unknown> {
  return {
    id: model.alias,
    type: "model",
    object: "model",
    display_name: `Together ${model.definition.name}`,
    max_input_tokens: safeClaudeInputLimit(model.definition),
    max_tokens: model.definition.limit.output,
    created_at: "2026-06-16T00:00:00Z",
  };
}

export function countTokensResponse(
  body: AnthropicCountTokensRequest,
  options?: Pick<ClaudeProxyOptions, "modelDefinition" | "modelId" | "targetModelId">,
): { input_tokens: number } {
  const targetModel = options
    ? resolveTargetModel(body.model, options as ClaudeProxyOptions).definition
    : undefined;
  const text = stableStringify({
    messages: targetModel
      ? toOpenAIMessages({ ...body, max_tokens: 1 }, targetModel)
      : [
          {
            system: body.system,
            messages: body.messages,
          },
        ],
    tools: body.tools,
    tool_choice: body.tool_choice,
  });
  const estimatedTokens = Math.max(
    1,
    Math.ceil(Buffer.byteLength(text, "utf8") / APPROX_CHARS_PER_TOKEN),
  );
  return {
    input_tokens: estimatedTokens,
  };
}

type TogetherReasoningEffort = "max";

function togetherReasoningEffort(
  body: AnthropicMessagesRequest,
  targetModel: ModelDefinition,
): TogetherReasoningEffort | undefined {
  if (targetModel.id !== GLM_5_2.id) {
    return undefined;
  }

  const explicitEffort = normalizeTogetherReasoningEffort(
    body.reasoning_effort ?? body.effort ?? body.thinking?.effort,
  );
  if (explicitEffort) {
    return explicitEffort;
  }

  const budgetTokens = body.thinking?.budget_tokens;
  if (typeof budgetTokens === "number" && Number.isFinite(budgetTokens) && budgetTokens >= 32_000) {
    return "max";
  }

  return undefined;
}

function normalizeTogetherReasoningEffort(value: unknown): TogetherReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const effort = value.toLowerCase();
  if (effort === "max" || effort === "xhigh") {
    return "max";
  }
  return undefined;
}

/**
 * POST to Together with automatic retry for transient faults (429 / 503 /
 * overloaded). On a non-retryable status, or after MAX_RETRIES retries, returns
 * `{ ok: false, error }` carrying the mapped Anthropic error shape — the caller
 * throws it to surface an honest error instead of flattening to 500.
 *
 * Backoff honors `Retry-After` when Together sends it (seconds or HTTP-date),
 * else exponential 1s → 2s → 4s with up to ±25% jitter. Deterministic jitter is
 * derived from the attempt index so the same call retraces the same waits
 * (Math.random would break workflow resume determinism).
 */
async function fetchTogether(
  payload: Record<string, unknown>,
  options: ClaudeProxyOptions,
  signal?: AbortSignal,
): Promise<TogetherFetchResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      // Network-level failure (DNS, connection reset, timeout). Treat as
      // retryable transient — the request never reached Together, so it's
      // safe to try again. If it keeps failing, surface as overloaded_error.
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return {
        ok: false,
        error: {
          status: 0,
          anthropicStatus: 503,
          anthropicType: "overloaded_error",
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        },
      };
    }

    if (response.ok) {
      return { ok: true, json: (await response.json()) as OpenAIChatResponse };
    }

    const error = await mapTogetherError(response);
    debugLog(options, "together error", {
      status: error.status,
      anthropicType: error.anthropicType,
      code: error.code,
      retryable: error.retryable,
      attempt,
      body: error.message.slice(0, 1000),
    });

    if (!error.retryable || attempt >= MAX_RETRIES) {
      return { ok: false, error };
    }
    await sleep(error.retryAfterMs ?? backoffMs(attempt));
  }
  // Unreachable: loop returns on every path. Satisfies exhaustiveness.
  return {
    ok: false,
    error: {
      status: 0,
      anthropicStatus: 500,
      anthropicType: "api_error",
      message: "Together request failed after retries.",
      retryable: false,
    },
  };
}

/**
 * Read a non-OK Together response and normalize it into a TogetherApiError with
 * the mapped Anthropic error type. Pulls the human message and code from
 * Together's `error` object (it nests message under `error.message` for
 * validation errors, and as a string for auth errors).
 */
async function mapTogetherError(response: Response): Promise<TogetherApiError> {
  const raw = await response.text();
  let code: string | undefined;
  let message = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string | { message?: string; type?: string; code?: string };
        type?: string;
        code?: string;
      };
    };
    const err = parsed.error;
    if (err) {
      code = err.code ?? (typeof err.message === "object" ? err.message.code : undefined);
      const msg =
        typeof err.message === "object"
          ? err.message.message
          : typeof err.message === "string"
            ? err.message
            : undefined;
      message = msg ?? err.type ?? message;
    }
  } catch {
    // Keep the raw slice as the message if the body wasn't JSON.
  }

  const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
  const retryable =
    RETRYABLE_STATUSES.has(response.status) ||
    (typeof code === "string" && RETRYABLE_ERROR_CODES.has(code));

  const mapped = mapStatusToAnthropicError(response.status);
  return {
    status: response.status,
    anthropicStatus: mapped.status,
    anthropicType: mapped.type,
    message: `Together API returned ${response.status}: ${message}`,
    code,
    retryAfterMs,
    retryable,
  };
}

/**
 * Map an upstream HTTP status to the Anthropic error shape Claude Code knows how
 * to render (the binary recognizes api_error, authentication_error,
 * rate_limit_error, invalid_request_error, overloaded_error, not_found_error,
 * permission_error, billing_error, timeout_error). Defaults to api_error.
 */
function mapStatusToAnthropicError(status: number): { status: number; type: string } {
  switch (status) {
    case 400:
      return { status: 400, type: "invalid_request_error" };
    case 401:
      return { status: 401, type: "authentication_error" };
    case 402:
      return { status: 402, type: "billing_error" };
    case 403:
      return { status: 403, type: "permission_error" };
    case 404:
      return { status: 404, type: "not_found_error" };
    case 408:
      return { status: 408, type: "timeout_error" };
    case 429:
      return { status: 429, type: "rate_limit_error" };
    case 503:
      return { status: 503, type: "overloaded_error" };
    case 500:
    case 502:
    case 504:
      return { status: 500, type: "api_error" };
    default:
      return { status: status || 500, type: "api_error" };
  }
}

/** Parse a Retry-After header (integer seconds or HTTP-date) to milliseconds. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

/** Exponential backoff: 1s, 2s, 4s (for attempts 0,1,2). */
function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** attempt; // 1s, 2s, 4s
  // Deterministic ±25% jitter from the attempt index so waits are spread across
  // concurrent requests without Math.random (which would break resume determinism).
  const jitter = (attempt % 2 === 0 ? 1 : -1) * base * 0.2;
  return Math.max(100, base + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toOpenAITools(
  tools: AnthropicTool[] | undefined,
  options?: Pick<ClaudeProxyOptions, "debug">,
): OpenAITool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  const hasNativeWebSearch = tools.some(isNativeWebSearchTool);
  return tools.flatMap((tool) => {
    if (hasNativeWebSearch && !isNativeWebSearchTool(tool) && tool.name === "web_search") {
      debugLog(options as ClaudeProxyOptions, "dropped colliding custom web_search tool", {
        name: tool.name,
        type: tool.type,
      });
      return [];
    }
    return [
      {
        type: "function",
        function: {
          name: openAIToolName(tool),
          description: tool.description ?? "",
          parameters: toOpenAIToolParameters(tool),
        },
      },
    ];
  });
}

function openAIToolName(tool: AnthropicTool): string {
  return isNativeWebSearchTool(tool) ? "web_search" : (tool.name ?? "tool");
}

function toOpenAIToolParameters(tool: AnthropicTool): unknown {
  if (tool.input_schema) {
    return tool.input_schema;
  }
  if (isNativeWebSearchTool(tool)) {
    return {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    };
  }
  return { type: "object", properties: {} };
}

function toOpenAIToolChoice(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object") {
    return undefined;
  }
  const choice = toolChoice as { type?: unknown; name?: unknown };
  if (choice.type === "auto") {
    return "auto";
  }
  if (choice.type === "any") {
    return "required";
  }
  if (choice.type === "tool" && typeof choice.name === "string" && choice.name) {
    return { type: "function", function: { name: choice.name } };
  }
  return undefined;
}

function nativeServerTools(tools: AnthropicTool[] | undefined): NativeServerTool[] {
  return (tools ?? []).flatMap((tool) => {
    if (!isNativeWebSearchTool(tool)) {
      return [];
    }
    return [{ kind: "web_search", name: "web_search", definition: tool }];
  });
}

function isNativeWebSearchTool(tool: AnthropicTool): boolean {
  return tool.type?.startsWith("web_search") === true;
}

function nativeToolMaxUses(tool: AnthropicTool): number {
  return typeof tool.max_uses === "number" && Number.isFinite(tool.max_uses)
    ? Math.max(0, Math.floor(tool.max_uses))
    : 5;
}

function withNativeToolSystemPrompt(
  messages: OpenAIMessage[],
  nativeTools: NativeServerTool[],
): OpenAIMessage[] {
  const prompt = [
    "Native server tools are available through function calls.",
    ...nativeTools.map(
      (tool) =>
        `- ${tool.name}: call this for live web search. Always provide a concise non-empty query.`,
    ),
    "After tool results are returned, answer from the provided sources and include source URLs when relevant.",
  ].join("\n");
  return mergeLeadingSystemMessages([{ role: "system", content: prompt }, ...messages]);
}

async function runExaSearch(
  input: unknown,
  tool: AnthropicTool,
  options: ClaudeProxyOptions,
): Promise<string> {
  const query = webSearchQuery(input);
  if (!query) {
    return "Web search error: missing query.";
  }

  const allowedDomains = stringArray(tool.allowed_domains);
  const blockedDomains = stringArray(tool.blocked_domains);
  const includeDomains = allowedDomains.length > 0 ? allowedDomains : undefined;
  const excludeDomains = blockedDomains.length > 0 ? blockedDomains : undefined;

  const body: Record<string, unknown> = {
    query,
    numResults: 5,
    type: "auto",
    contents: { text: true },
  };
  if (includeDomains) {
    body.includeDomains = includeDomains;
  }
  if (excludeDomains) {
    body.excludeDomains = excludeDomains;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const exaApiKey = process.env.EXA_API_KEY?.trim();
  if (!exaApiKey) {
    return "Web search error: EXA_API_KEY is not set. Set it in the repo .env (EXA_API_KEY=...) and retry.";
  }
  headers["x-api-key"] = exaApiKey;

  debugLog(options, "exa search request", { query, hasApiKey: Boolean(exaApiKey), body });
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    debugLog(options, "exa search error", { status: response.status, body: text.slice(0, 1000) });
    return `Web search error from Exa (${response.status}): ${text.slice(0, 1200)}`;
  }

  let json: ExaSearchResponse;
  try {
    json = JSON.parse(text) as ExaSearchResponse;
  } catch {
    return `Web search error: Exa returned non-JSON content: ${text.slice(0, 1200)}`;
  }

  const results = (json.results ?? []).slice(0, 5);
  if (results.length === 0) {
    return `Web search completed for "${query}" but returned no results.${json.autopromptString ? ` Autoprompt: ${json.autopromptString}` : ""}`;
  }

  const lines = [`Web search results for "${query}" via Exa:`];
  results.forEach((result, index) => {
    lines.push(
      [
        `${index + 1}. ${result.title ?? "Untitled"}`,
        `URL: ${result.url ?? ""}`,
        `Snippet: ${trimSearchText(result.text ?? "")}`,
      ].join("\n"),
    );
  });
  if (json.autopromptString) {
    lines.push(`Autoprompt: ${json.autopromptString}`);
  }
  return lines.join("\n\n");
}

function webSearchQuery(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input !== "object" || input === null) {
    return "";
  }
  const value =
    (input as { query?: unknown; q?: unknown }).query ??
    (input as { query?: unknown; q?: unknown }).q;
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function trimSearchText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

function toOpenAIMessages(
  body: AnthropicMessagesRequest,
  targetModel?: ModelDefinition,
): OpenAIMessage[] {
  const systemParts = [
    targetModel
      ? `${TOGETHERLINK_IDENTITY_PROMPT} Backend: ${targetModel.name} (${targetModel.id}).`
      : TOGETHERLINK_IDENTITY_PROMPT,
  ];
  const system = stringifyAnthropicContent(body.system);
  if (system) {
    systemParts.push(system);
  }
  const messages: OpenAIMessage[] = [{ role: "system", content: systemParts.join("\n\n") }];

  for (const message of body.messages ?? []) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }

    const textParts: string[] = [];
    const reasoningParts: string[] = [];
    const toolCalls: OpenAIMessage["tool_calls"] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "thinking") {
        reasoningParts.push(block.thinking);
      } else if (block.type === "redacted_thinking") {
        reasoningParts.push(block.data);
      } else if (block.type === "tool_result") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: formatToolResultContent(block.content, block.is_error),
        });
      } else if (
        block.type === "web_search_tool_result" ||
        block.type === "web_search_tool_result_error"
      ) {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id ?? "web_search",
          content: formatWebSearchToolResult(block),
        });
      } else if (block.type === "tool_use" || block.type === "server_tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }

    const content = textParts.join("\n");
    if (content || reasoningParts.length > 0 || toolCalls.length > 0) {
      messages.push({
        role: message.role,
        content: content || null,
        ...(reasoningParts.length > 0 ? { reasoning_content: reasoningParts.join("\n") } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    }
  }

  return messages;
}

function mergeLeadingSystemMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
  const systemParts: string[] = [];
  let index = 0;
  while (index < messages.length && messages[index]?.role === "system") {
    const content = messages[index]?.content;
    if (typeof content === "string" && content.trim()) {
      systemParts.push(content);
    }
    index += 1;
  }
  if (systemParts.length === 0) {
    return messages.slice(index);
  }
  return [{ role: "system", content: systemParts.join("\n\n") }, ...messages.slice(index)];
}

function toAnthropicMessage(response: OpenAIChatResponse, model: string): Record<string, unknown> {
  const choice = response.choices?.[0];
  const message = choice?.message ?? {};
  const content: Array<Record<string, unknown>> = [];
  const reasoning = message.reasoning ?? message.reasoning_content;
  if (reasoning) {
    content.push({
      type: "thinking",
      thinking: reasoning,
      signature: thinkingSignature(reasoning),
    });
  }
  if (message.content) {
    content.push({ type: "text", text: message.content });
  }
  for (const toolCall of message.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: toolCall.id ?? `toolu_${randomUUID().replaceAll("-", "")}`,
      name: toolCall.function?.name ?? "tool",
      input: parseJsonOrEmpty(toolCall.function?.arguments),
    });
  }

  return {
    id: response.id ?? `msg_${randomUUID().replaceAll("-", "")}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: message.tool_calls?.length ? "tool_use" : mapStopReason(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Stream Together's chat-completions SSE straight through to Claude Code as
 * Anthropic-shaped SSE, emitting reasoning / text / tool_use deltas as they
 * arrive. This is what makes Claude Code show first tokens and the live
 * thinking trace while GLM is still generating — the buffered path waited for
 * the entire generation (including all high-effort reasoning) before emitting
 * anything, so perceived latency equaled total generation time.
 *
 * Block ordering is the correctness-critical part: Anthropic SSE requires
 * contiguous content_block indices, each block opened with content_block_start
 * before any delta and closed with content_block_stop before the next opens. We
 * track which block types are open and only start each once. reasoning → text →
 * tool_use, in that arrival order.
 *
 * If the upstream call fails (non-OK status after retries), we surface an honest
 * Anthropic error event if nothing has been streamed yet; if we've already
 * started streaming, the partial stream is already in the client's hands and we
 * just close (the standard SSE failure shape).
 */
async function streamAnthropicFromTogether(
  res: ServerResponse,
  body: AnthropicMessagesRequest,
  options: ClaudeProxyOptions,
  signal?: AbortSignal,
): Promise<StreamProxyResult> {
  const targetModel = resolveTargetModel(body.model, options);
  const messages = toOpenAIMessages(body, targetModel.definition);
  const nativeTools = nativeServerTools(body.tools);
  const upstreamMessages =
    nativeTools.length > 0 ? withNativeToolSystemPrompt(messages, nativeTools) : messages;
  const tools = toOpenAITools(body.tools, options);
  const reasoningEffort = togetherReasoningEffort(body, targetModel.definition);
  let maxTokens = clampRequestedMaxTokens(body.max_tokens, targetModel.definition);

  const payload = {
    model: targetModel.definition.id,
    messages: upstreamMessages,
    max_tokens: maxTokens,
    stop: body.stop_sequences,
    temperature: body.temperature,
    tools,
    tool_choice: toOpenAIToolChoice(body.tool_choice),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    chat_template_kwargs: { clear_thinking: false },
    stream: true,
    // Guarantee Together sends a usage chunk at the end so cost tracking has
    // real token counts (without this, some streamed responses omit usage).
    stream_options: { include_usage: true },
  };
  applyEstimatedContextBudget(payload, targetModel.definition, options, "stream");
  maxTokens = typeof payload.max_tokens === "number" ? payload.max_tokens : maxTokens;

  debugLog(options, "together stream request", {
    model: payload.model,
    messageCount: payload.messages.length,
    toolCount: payload.tools?.length ?? 0,
    maxTokens: payload.max_tokens,
    reasoningEffort,
  });

  let response: Response;
  try {
    response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeAnthropicError(res, 503, "overloaded_error", message);
    return { ok: false, status: 503, error: message };
  }

  if (!response.ok) {
    let error = await mapTogetherError(response);
    const retryMaxTokens = maxTokensForContextLengthRetry(error, targetModel.definition, maxTokens);
    if (retryMaxTokens !== undefined) {
      maxTokens = retryMaxTokens;
      payload.max_tokens = maxTokens;
      debugLog(options, "retrying together stream with reduced max_tokens", {
        model: payload.model,
        maxTokens,
        originalError: error.message,
      });
      try {
        response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          ...(signal ? { signal } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeAnthropicError(res, 503, "overloaded_error", message);
        return { ok: false, status: 503, error: message };
      }
      if (!response.ok) {
        error = await mapTogetherError(response);
      }
    } else if (canTrimInputForContextLengthRetry(error, targetModel.definition)) {
      const trimmed = trimPayloadInputForContextLengthRetry(payload, error, targetModel.definition);
      if (trimmed) {
        debugLog(options, "retrying together stream with trimmed input context", {
          model: payload.model,
          trimmedChars: trimmed.trimmedChars,
          originalError: error.message,
        });
        try {
          response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            ...(signal ? { signal } : {}),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeAnthropicError(res, 503, "overloaded_error", message);
          return { ok: false, status: 503, error: message };
        }
        if (!response.ok) {
          error = await mapTogetherError(response);
        }
      }
    }
    if (!response.ok) {
      debugLog(options, "together stream error", {
        status: error.status,
        anthropicType: error.anthropicType,
        code: error.code,
        body: error.message.slice(0, 1000),
      });
      writeAnthropicError(res, error.anthropicStatus, error.anthropicType, error.message);
      return { ok: false, status: error.anthropicStatus, error: error.message };
    }
  }
  if (!response.body) {
    const message = "Together returned no stream body.";
    writeAnthropicError(res, 500, "api_error", message);
    return { ok: false, status: 500, error: message };
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const messageId = `msg_${randomUUID().replaceAll("-", "")}`;
  const model = body.model ?? options.modelId;
  // Start the stream with an empty message; content blocks are added as the
  // upstream emits them. usage is filled in from the final usage chunk (or
  // stays 0 if Together omits it despite include_usage).
  writeSse(res, "message_start", {
    type: "message_start",
    message: {
      id: messageId,
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });

  if (nativeTools.length > 0) {
    return await streamAnthropicNativeToolLoop({
      res,
      initialResponse: response,
      initialPayload: payload,
      initialMessages: upstreamMessages.slice(),
      nativeTools,
      targetModel: targetModel.definition,
      model,
      options,
      ...(signal ? { signal } : {}),
    });
  }

  const blockManager = new StreamBlockManager(res);
  let stopReason = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSseLines(buffer, (data) => {
        if (!data) {
          return;
        }
        const event = parseStreamData(data);
        if (!event) {
          return;
        }
        const delta = event.delta;
        if (delta) {
          const reasoning = delta.reasoning ?? delta.reasoning_content;
          if (typeof reasoning === "string" && reasoning.length > 0) {
            blockManager.emitThinking(reasoning);
          }
          if (typeof delta.content === "string" && delta.content.length > 0) {
            blockManager.emitText(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const toolCall of delta.tool_calls) {
              blockManager.emitToolCall(toolCall);
            }
          }
        }
        if (event.usage) {
          inputTokens = event.usage.prompt_tokens ?? inputTokens;
          outputTokens = event.usage.completion_tokens ?? outputTokens;
          cachedTokens =
            event.usage.prompt_tokens_details?.cached_tokens ??
            event.usage.cached_tokens ??
            cachedTokens;
        }
        if (event.finish_reason) {
          stopReason = mapStopReason(event.finish_reason);
        }
      });
    }
  } catch (err) {
    debugLog(options, "together stream read error", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Mid-stream failure: best-effort close whatever block is open, then end.
    // The client already has partial output; we can't retroactively emit an
    // error event in a way Anthropic SSE expects after content has started.
  }

  blockManager.close();
  if (inputTokens > 0 || outputTokens > 0) {
    options.costTracker?.addUsage(inputTokens, cachedTokens, outputTokens, targetModel.definition);
  }
  debugLog(options, "together stream done", {
    stopReason,
    usage: { inputTokens, outputTokens, cachedTokens },
    blocks: blockManager.summary(),
  });

  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
  return { ok: true, status: res.statusCode };
}

type CollectedStreamToolCall = {
  id?: string;
  index: number;
  function: { name?: string; arguments: string };
};

type CollectedStreamTurn = {
  reasoning: string;
  text: string;
  toolCalls: CollectedStreamToolCall[];
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

async function streamAnthropicNativeToolLoop({
  res,
  initialResponse,
  initialPayload,
  initialMessages,
  nativeTools,
  targetModel,
  model,
  options,
  signal,
}: {
  res: ServerResponse;
  initialResponse: Response;
  initialPayload: Record<string, unknown>;
  initialMessages: OpenAIMessage[];
  nativeTools: NativeServerTool[];
  targetModel: ModelDefinition;
  model: string;
  options: ClaudeProxyOptions;
  signal?: AbortSignal;
}): Promise<StreamProxyResult> {
  const blockManager = new StreamBlockManager(res);
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map<string, number>();
  const messages = initialMessages.slice();
  let response = initialResponse;
  let stopReason = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  for (let turn = 0; turn < 5; turn += 1) {
    const collected = await collectTogetherStreamTurn(response, options);
    inputTokens += collected.inputTokens;
    outputTokens += collected.outputTokens;
    cachedTokens += collected.cachedTokens;
    stopReason = collected.stopReason;

    const nativeToolCalls = collected.toolCalls.filter((toolCall) =>
      nativeToolNames.has(toolCall.function.name ?? ""),
    );
    if (nativeToolCalls.length === 0) {
      emitCollectedStreamTurn(blockManager, collected);
      break;
    }

    debugLog(options, "stream native tool calls", {
      turn,
      toolCalls: nativeToolCalls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        argumentsPreview: toolCall.function.arguments.slice(0, 300),
      })),
    });

    messages.push({
      role: "assistant",
      content: collected.text || null,
      ...(collected.reasoning ? { reasoning_content: collected.reasoning } : {}),
      tool_calls: collected.toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function.name ?? "tool",
          arguments: toolCall.function.arguments || "{}",
        },
      })),
    });

    for (const toolCall of nativeToolCalls) {
      const id = toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`;
      const name = toolCall.function.name ?? "web_search";
      const nativeTool = nativeTools.find((tool) => tool.name === name);
      const input = parseJsonOrEmpty(toolCall.function.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const maxUses = nativeTool ? nativeToolMaxUses(nativeTool.definition) : 0;
      let result: string;
      if (priorUses >= maxUses) {
        result = `Web search error: max_uses_exceeded for ${name}. Do not call this tool again; answer from the results already provided or say search is unavailable.`;
      } else if (nativeTool?.kind === "web_search") {
        nativeToolUses.set(name, priorUses + 1);
        result = await runExaSearch(input, nativeTool.definition, options);
      } else {
        result = "Unsupported native server tool.";
      }
      messages.push({ role: "tool", tool_call_id: id, content: result });
    }

    const nextPayload: Record<string, unknown> = {
      ...initialPayload,
      messages,
      model: targetModel.id,
      stream: true,
      stream_options: { include_usage: true },
    };
    debugLog(options, "together stream native continuation request", {
      model: nextPayload.model,
      messageCount: messages.length,
      toolCount: Array.isArray(nextPayload.tools) ? nextPayload.tools.length : 0,
      turn: turn + 1,
    });
    let nextResponse: Response;
    try {
      nextResponse = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPayload),
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      emitCollectedStreamTurn(blockManager, {
        reasoning: "",
        text: `Native server tool continuation failed: ${err instanceof Error ? err.message : String(err)}`,
        toolCalls: [],
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
      });
      stopReason = "end_turn";
      break;
    }
    if (!nextResponse.ok || !nextResponse.body) {
      const error = !nextResponse.ok ? await mapTogetherError(nextResponse) : undefined;
      emitCollectedStreamTurn(blockManager, {
        reasoning: "",
        text:
          error?.message ?? "Together returned no stream body after native server tool execution.",
        toolCalls: [],
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
      });
      stopReason = "end_turn";
      break;
    }
    response = nextResponse;
  }

  blockManager.close();
  if (inputTokens > 0 || outputTokens > 0) {
    options.costTracker?.addUsage(inputTokens, cachedTokens, outputTokens, targetModel);
  }
  debugLog(options, "together native stream done", {
    model,
    stopReason,
    usage: { inputTokens, outputTokens, cachedTokens },
    blocks: blockManager.summary(),
  });
  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
  return { ok: true, status: res.statusCode };
}

async function collectTogetherStreamTurn(
  response: Response,
  options: ClaudeProxyOptions,
): Promise<CollectedStreamTurn> {
  const toolCalls = new Map<number, CollectedStreamToolCall>();
  const turn: CollectedStreamTurn = {
    reasoning: "",
    text: "",
    toolCalls: [],
    stopReason: "end_turn",
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
  };
  if (!response.body) {
    return turn;
  }
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSseLines(buffer, (data) => {
        if (!data) {
          return;
        }
        const event = parseStreamData(data);
        if (!event) {
          return;
        }
        const delta = event.delta;
        if (delta) {
          const reasoning = delta.reasoning ?? delta.reasoning_content;
          if (typeof reasoning === "string") {
            turn.reasoning += reasoning;
          }
          if (typeof delta.content === "string") {
            turn.text += delta.content;
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const chunk of delta.tool_calls) {
              const index = typeof chunk.index === "number" ? chunk.index : 0;
              const existing = toolCalls.get(index) ?? { index, function: { arguments: "" } };
              if (chunk.id) {
                existing.id = chunk.id;
              }
              if (chunk.function?.name) {
                existing.function.name = chunk.function.name;
              }
              if (chunk.function?.arguments) {
                existing.function.arguments += chunk.function.arguments;
              }
              toolCalls.set(index, existing);
            }
          }
        }
        if (event.usage) {
          turn.inputTokens = event.usage.prompt_tokens ?? turn.inputTokens;
          turn.outputTokens = event.usage.completion_tokens ?? turn.outputTokens;
          turn.cachedTokens =
            event.usage.prompt_tokens_details?.cached_tokens ??
            event.usage.cached_tokens ??
            turn.cachedTokens;
        }
        if (event.finish_reason) {
          turn.stopReason = mapStopReason(event.finish_reason);
        }
      });
    }
  } catch (err) {
    debugLog(options, "together native stream read error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  turn.toolCalls = [...toolCalls.values()].sort((a, b) => a.index - b.index);
  return turn;
}

function emitCollectedStreamTurn(
  blockManager: StreamBlockManager,
  turn: CollectedStreamTurn,
): void {
  if (turn.reasoning) {
    blockManager.emitThinking(turn.reasoning);
  }
  if (turn.text) {
    blockManager.emitText(turn.text);
  }
  for (const toolCall of turn.toolCalls) {
    const fn: { name?: string; arguments?: string } = {
      arguments: toolCall.function.arguments,
    };
    if (toolCall.function.name) {
      fn.name = toolCall.function.name;
    }
    const emittedToolCall: {
      index?: number;
      id?: string;
      function?: { name?: string; arguments?: string };
    } = {
      index: toolCall.index,
      function: fn,
    };
    if (toolCall.id) {
      emittedToolCall.id = toolCall.id;
    }
    blockManager.emitToolCall(emittedToolCall);
  }
}

/**
 * Parses one SSE `data:` JSON payload into a normalized stream event. Returns
 * null for non-JSON lines (Together occasionally sends `[DONE]` or comments).
 * Tolerates both `usage` on a final choices-bearing chunk and on a dedicated
 * empty-choices usage chunk (the `stream_options.include_usage` shape).
 */
function parseStreamData(data: string): {
  delta?: {
    reasoning?: string | null;
    reasoning_content?: string | null;
    content?: string | null;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }>;
  } | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  } | null;
  finish_reason?: string | null;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  const choices = obj.choices;
  const choice =
    Array.isArray(choices) && choices.length > 0 ? (choices[0] as Record<string, unknown>) : null;
  return {
    delta: (choice?.delta as Record<string, unknown> | undefined) ?? null,
    usage: (obj.usage as Record<string, unknown> | undefined) ?? null,
    finish_reason:
      typeof choice?.finish_reason === "string" ? (choice.finish_reason as string) : null,
  };
}

/**
 * Calls `onData` for each complete SSE `data:` line in `buffer`, returns the
 * leftover partial line (no trailing newline yet). SSE events are separated by
 * blank lines; a `data:` field may itself span multiple lines, so we join them
 * into one payload before parsing.
 */
function consumeSseLines(buffer: string, onData: (data: string) => void): string {
  let remaining = buffer;
  for (;;) {
    // Find the next event boundary (blank line = \n\n, or \r\n\r\n).
    const boundary = remaining.search(/\r?\n\r?\n/);
    if (boundary === -1) {
      break;
    }
    const rawEvent = remaining.slice(0, boundary);
    remaining = remaining.replace(/.*?(\r?\n){2}/s, "");
    // Within one event, concatenate every `data:` line (strip the prefix). A
    // multi-line data field arrives as separate `data:` lines per OpenAI SSE.
    const dataLines = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (dataLines.length > 0) {
      onData(dataLines.join("\n"));
    }
  }
  return remaining;
}

/**
 * Manages the content_block lifecycle on the Anthropic SSE stream. Tracks which
 * block type is currently open so we emit content_block_start exactly once per
 * block and content_block_stop before the next opens. Indices are contiguous
 * starting at 0, in arrival order: thinking → text → tool_use(…).
 */
class StreamBlockManager {
  private nextIndex = 0;
  private openBlock:
    | { type: "thinking"; index: number; reasoning: string }
    | { type: "text"; index: number }
    | { type: "tool_use"; index: number; id: string; name: string; arguments: string }
    | null = null;
  private blockCount = 0;

  constructor(private readonly res: ServerResponse) {}

  emitThinking(reasoning: string): void {
    if (!this.openBlock || this.openBlock.type !== "thinking") {
      this.closeOpenBlock();
      this.openBlock = { type: "thinking", index: this.nextIndex, reasoning: "" };
      writeSse(this.res, "content_block_start", {
        type: "content_block_start",
        index: this.openBlock.index,
        content_block: { type: "thinking", thinking: "", signature: "" },
      });
      this.blockCount += 1;
    }
    this.openBlock.reasoning += reasoning;
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: this.openBlock.index,
      delta: { type: "thinking_delta", thinking: reasoning },
    });
  }

  emitText(text: string): void {
    if (!this.openBlock || this.openBlock.type !== "text") {
      this.closeOpenBlock();
      this.openBlock = { type: "text", index: this.nextIndex };
      writeSse(this.res, "content_block_start", {
        type: "content_block_start",
        index: this.openBlock.index,
        content_block: { type: "text", text: "" },
      });
      this.blockCount += 1;
    }
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: this.openBlock.index,
      delta: { type: "text_delta", text },
    });
  }

  emitToolCall(toolCall: {
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }): void {
    // Tool calls arrive across multiple chunks: the first carries id + name,
    // later chunks carry arguments JSON fragments (possibly split mid-string).
    // We accumulate into one block keyed by Together's tool-call `index`; if
    // the index doesn't match the open tool_use block, start a new one.
    const tcIndex = typeof toolCall.index === "number" ? toolCall.index : 0;
    const name = toolCall.function?.name;
    const argsFragment = toolCall.function?.arguments ?? "";
    // A tool_use block is open and matches this delta when the open block is a
    // tool_use AND its upstream tool-call index equals this delta's index. A new
    // index means a new tool call → start a fresh block. Check the open block's
    // type directly (not via optional chaining) so TS narrows it to the
    // tool_use variant for reuse.
    const open = this.openBlock;
    if (open && open.type === "tool_use" && this.currentToolCallIndex === tcIndex) {
      if (argsFragment) {
        open.arguments += argsFragment;
        writeSse(this.res, "content_block_delta", {
          type: "content_block_delta",
          index: open.index,
          delta: { type: "input_json_delta", partial_json: argsFragment },
        });
      }
      return;
    }

    this.closeOpenBlock();
    const id = toolCall.id ?? `toolu_${randomUUID().replaceAll("-", "")}`;
    const toolName = name ?? "tool";
    const block: { type: "tool_use"; index: number; id: string; name: string; arguments: string } =
      {
        type: "tool_use",
        index: this.nextIndex,
        id,
        name: toolName,
        arguments: "",
      };
    this.openBlock = block;
    this.currentToolCallIndex = tcIndex;
    writeSse(this.res, "content_block_start", {
      type: "content_block_start",
      index: block.index,
      // Anthropic streams tool_use with input: {} on the start event; the
      // real input arrives as input_json_delta fragments that the client
      // accumulates into the final input object.
      content_block: { type: "tool_use", id, name: toolName, input: {} },
    });
    this.blockCount += 1;
    if (argsFragment) {
      block.arguments += argsFragment;
      writeSse(this.res, "content_block_delta", {
        type: "content_block_delta",
        index: block.index,
        delta: { type: "input_json_delta", partial_json: argsFragment },
      });
    }
  }

  private currentToolCallIndex = -1;

  closeOpenBlock(): void {
    if (!this.openBlock) {
      return;
    }
    // For a thinking block, emit a compact stable signature before closing.
    // Do not base64 the full reasoning text here: Claude Code counts the
    // signature in its output budget, so duplicating long reasoning can make an
    // otherwise valid response exceed its 32k output-token guard.
    if (this.openBlock.type === "thinking") {
      writeSse(this.res, "content_block_delta", {
        type: "content_block_delta",
        index: this.openBlock.index,
        delta: { type: "signature_delta", signature: thinkingSignature(this.openBlock.reasoning) },
      });
    }
    writeSse(this.res, "content_block_stop", {
      type: "content_block_stop",
      index: this.openBlock.index,
    });
    this.nextIndex += 1;
    this.openBlock = null;
  }

  close(): void {
    this.closeOpenBlock();
  }

  summary(): string {
    return `${this.blockCount} block(s)`;
  }
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

export function writeAnthropicError(
  res: ServerResponse,
  status: number,
  type: string,
  message: string,
): void {
  writeJson(res, status, {
    type: "error",
    error: { type, message },
  });
}

/** Whether a thrown value is a normalized Together upstream error. */
export function isTogetherApiError(value: unknown): value is TogetherApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "anthropicType" in value &&
    "anthropicStatus" in value &&
    "retryable" in value
  );
}

function debugLog(options: ClaudeProxyOptions, label: string, value: unknown): void {
  if (!options.debug) {
    return;
  }
  const line = `[togetherlink proxy] ${label}: ${JSON.stringify(value)}\n`;
  process.stderr.write(line);
  if (process.env.TOGETHERLINK_DEBUG_LOG) {
    appendFileSync(process.env.TOGETHERLINK_DEBUG_LOG, line);
  }
}

export function requestPath(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function stringifyAnthropicContent(content: AnthropicMessagesRequest["system"]): string {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function stringifyUnknown(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

function formatToolResultContent(content: unknown, isError?: boolean): string {
  const prefix = isError ? "[tool_result error]\n" : "";
  if (typeof content === "string") {
    return `${prefix}${content}`;
  }
  if (Array.isArray(content)) {
    const parts = content.map(formatContentBlockForToolResult).filter((part) => part.length > 0);
    return `${prefix}${parts.join("\n")}`;
  }
  return `${prefix}${stringifyUnknown(content)}`;
}

function formatContentBlockForToolResult(block: unknown): string {
  if (typeof block !== "object" || block === null) {
    return stringifyUnknown(block);
  }
  const record = block as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  if (record.type === "image") {
    const source =
      typeof record.source === "object" && record.source !== null
        ? (record.source as Record<string, unknown>)
        : {};
    const mediaType = typeof source.media_type === "string" ? ` ${source.media_type}` : "";
    return `[image${mediaType} in tool result]`;
  }
  if (record.type === "url" && typeof record.url === "string") {
    return `[url in tool result] ${record.url}`;
  }
  return stringifyUnknown(block);
}

function formatWebSearchToolResult(
  block: Extract<
    AnthropicContentBlock,
    { type: "web_search_tool_result" | "web_search_tool_result_error" }
  >,
): string {
  const errorCode = typeof block.error_code === "string" ? block.error_code : undefined;
  if (block.type === "web_search_tool_result_error") {
    return `Web search error${errorCode ? ` (${errorCode})` : ""}: ${formatToolResultContent(block.content)}`;
  }
  const content = block.content;
  if (Array.isArray(content)) {
    const lines = content.flatMap((item, index) => formatWebSearchResultItem(item, index));
    return lines.length > 0 ? lines.join("\n\n") : "Web search returned no results.";
  }
  if (typeof content === "object" && content !== null) {
    const record = content as Record<string, unknown>;
    if (record.type === "web_search_tool_result_error") {
      const code = typeof record.error_code === "string" ? record.error_code : errorCode;
      return `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`;
    }
  }
  return formatToolResultContent(content);
}

function formatWebSearchResultItem(item: unknown, index: number): string[] {
  if (typeof item !== "object" || item === null) {
    return [`${index + 1}. ${stringifyUnknown(item)}`];
  }
  const record = item as Record<string, unknown>;
  if (record.type === "web_search_tool_result_error") {
    const code = typeof record.error_code === "string" ? record.error_code : undefined;
    return [
      `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`,
    ];
  }
  const title =
    stringField(record, "title") ?? stringField(record, "page_title") ?? "Untitled result";
  const url = stringField(record, "url") ?? stringField(record, "source");
  const snippet =
    stringField(record, "text") ??
    stringField(record, "snippet") ??
    stringField(record, "description");
  return [
    [
      `${index + 1}. ${title}`,
      ...(url ? [`URL: ${url}`] : []),
      ...(snippet ? [`Snippet: ${trimSearchText(snippet)}`] : []),
    ].join("\n"),
  ];
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Small bounded LRU keyed by string. Uses a Map's insertion-order semantics:
 * `get` re-inserts (delete + set) to move the entry to the most-recently-used
 * position; `set` evicts the oldest entry (the Map's first key) while the entry
 * count or the approximate byte total exceeds the cap. No timers, no external
 * deps — just stdlib. The `byteSize` of a value defaults to its string length
 * (good enough for ASCII-dominant description text).
 */
class LruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly sizeOf: (value: V) => number;
  private bytes = 0;

  constructor(maxEntries: number, maxBytes: number, sizeOf?: (value: V) => number) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf ?? ((value) => (typeof value === "string" ? value.length : 1));
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key) as V;
    // Move to most-recently-used: delete + re-insert.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      this.bytes -= this.sizeOf(existing);
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.bytes += this.sizeOf(value);
    this.evict(key);
  }

  get size(): number {
    return this.map.size;
  }

  /**
   * Evict oldest entries until we're under the entry and byte caps. `justSet`
   * is the key we just inserted; we never evict it, so a single entry larger
   * than the byte cap (a long image description) is still cached for its first
   * turn rather than being evicted the instant it's inserted and re-billed
   * every turn — the cap is a guardrail, not an exact budget.
   */
  private evict(justSet?: K): void {
    while (this.map.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next();
      if (oldest.done) {
        break;
      }
      const key = oldest.value;
      if (key === justSet) {
        // The only over-budget entry is the one we just added; keep it.
        break;
      }
      const value = this.map.get(key) as V;
      this.bytes -= this.sizeOf(value);
      this.map.delete(key);
    }
    if (this.bytes < 0) {
      this.bytes = 0;
    }
  }
}

// Cross-request cache: the same image recurs in conversation history across
// turns, so keep its description to avoid re-billing the vision model each time.
// Bounded so a long session of distinct images can't grow the daemon's heap
// without limit: evict the least-recently-used entry once we exceed either the
// entry cap or the (approximate) byte cap. Byte size is approximated by the
// description string length — ASCII-dominant text, so length ≈ bytes; the cap is
// a guardrail, not an exact budget.
const IMAGE_CACHE_MAX_ENTRIES = 64;
const IMAGE_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const imageDescriptionCache = new LruCache<string, string>(
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_MAX_BYTES,
);

/**
 * Find every image/url block in the request, describe it with the vision model,
 * and replace it in place with a `text` block holding the description. GLM-5.2
 * is text-only, so this is what lets Claude Code's images reach the model.
 */
async function resolveImageBlocks(
  body: AnthropicMessagesRequest,
  options: ClaudeProxyOptions,
): Promise<void> {
  const descriptions = new Map<string, string>();

  const resolve = async (block: AnthropicContentBlock): Promise<AnthropicContentBlock> => {
    if (!isImageBlock(block) && !isUrlImageBlock(block)) {
      return block;
    }
    const key = imageBlockKey(block);
    let cached = descriptions.get(key) ?? imageDescriptionCache.get(key);
    if (cached === undefined) {
      debugLog(options, "vision describe start", { key });
      const result = await describeImage(block as ImageBlock | UrlBlock, {
        apiKey: options.apiKey,
        debug: options.debug,
      });
      debugLog(options, "vision describe done", {
        key,
        model: result.model,
        length: result.description.length,
        preview: result.description.slice(0, 200),
      });
      if (result.usage) {
        options.costTracker?.addVisionUsage(
          result.model,
          result.usage.promptTokens,
          result.usage.completionTokens,
        );
      }
      cached = `${result.description}\n[described by ${result.model}]`;
      imageDescriptionCache.set(key, cached);
    }
    descriptions.set(key, cached);
    return { type: "text", text: `[Image description]\n${cached}` };
  };

  // Replace image blocks inside the system content array.
  if (Array.isArray(body.system)) {
    body.system = await Promise.all(body.system.map((block) => resolve(block)));
  }

  // Replace image blocks inside each message's content array.
  for (const message of body.messages ?? []) {
    if (Array.isArray(message.content)) {
      message.content = await Promise.all(
        message.content.map(async (block) => {
          const resolved = await resolve(block);
          if (resolved.type === "tool_result" && Array.isArray(resolved.content)) {
            resolved.content = await Promise.all(
              resolved.content.map(async (innerBlock) => {
                return typeof innerBlock === "object" && innerBlock !== null
                  ? await resolve(innerBlock as AnthropicContentBlock)
                  : innerBlock;
              }),
            );
          }
          return resolved;
        }),
      );
    }
  }
}

/**
 * Walks the request for image-like content blocks and returns a debug-friendly
 * summary (base64/url data truncated). Used to learn the exact shape Claude
 * Code sends when a user attaches a photo or screenshot, so the proxy can
 * intercept and route images to a vision-capable Together model.
 */
function extractImageBlocks(body: AnthropicMessagesRequest): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const knownTypes = new Set([
    "text",
    "thinking",
    "redacted_thinking",
    "tool_use",
    "server_tool_use",
    "tool_result",
    "web_search_tool_result",
    "web_search_tool_result_error",
  ]);

  const inspectBlock = (block: unknown, location: string): void => {
    if (typeof block !== "object" || block === null) {
      return;
    }
    const record = block as Record<string, unknown>;
    const type = record.type;
    const isImageLike =
      type === "image" ||
      type === "url" ||
      type === "document" ||
      (typeof type === "string" && !knownTypes.has(type));
    if (!isImageLike) {
      return;
    }
    const summary: Record<string, unknown> = { location, type, rawKeys: Object.keys(record) };
    const source = record.source as Record<string, unknown> | undefined;
    if (source) {
      summary.sourceType = source.type;
      summary.mediaType = source.media_type;
      const data = source.data;
      summary.dataPreview =
        typeof data === "string" ? `${data.slice(0, 32)}… (${data.length} chars)` : typeof data;
    }
    const url = record.url;
    if (typeof url === "string") {
      summary.urlPreview = url.length > 64 ? `${url.slice(0, 64)}…` : url;
    }
    found.push(summary);
  };

  const inspectContent = (content: unknown, location: string): void => {
    if (!Array.isArray(content)) {
      return;
    }
    for (const block of content) {
      inspectBlock(block, location);
      // tool_result content can itself be an array of blocks (e.g. an image
      // returned by a tool), so recurse one level.
      const inner = (block as Record<string, unknown> | null)?.content;
      if (Array.isArray(inner)) {
        for (const innerBlock of inner) {
          inspectBlock(innerBlock, `${location}/tool_result`);
        }
      }
    }
  };

  inspectContent(body.system, "system");
  for (const message of body.messages ?? []) {
    inspectContent(message.content, `messages[${message.role}]`);
  }
  return found;
}

function summarizeAnthropicTools(
  tools: AnthropicTool[] | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    maxUses: tool.max_uses,
    inputSchemaKeys: objectKeys(tool.input_schema),
    rawKeys: Object.keys(tool),
  }));
}

function objectKeys(value: unknown): string[] | undefined {
  return typeof value === "object" && value !== null ? Object.keys(value) : undefined;
}

function parseJsonOrEmpty(value: string | undefined): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mapStopReason(reason: string | null | undefined): string {
  if (reason === "tool_calls") {
    return "tool_use";
  }
  if (reason === "length") {
    return "max_tokens";
  }
  return "end_turn";
}
