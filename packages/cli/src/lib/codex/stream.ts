import { randomUUID } from "node:crypto";
import { type ServerResponse } from "node:http";
import { type ModelDefinition } from "@togetherlink/models";
import type { CostTracker } from "../cost.js";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { type ProxyPerfTracer } from "../proxy-perf.js";
import { backoffMs, sleep } from "../together-retry.js";
import { TogetherResponseHeaderTimeoutError } from "../together-client.js";
import {
  readTogetherSseWithRetry,
  TogetherSseIdleTimeoutError,
  TogetherSsePrematureCloseError,
  TogetherSseRetryResponseError,
} from "../together-stream.js";
import { writeResponsesSse } from "./sse.js";
import { parseJsonOrEmpty } from "./content-format.js";
import { codexNativeToolMaxUses, runCodexExaSearch } from "./translate-request.js";
import {
  messageOutputItem,
  openReasoningOutputItem,
  openTextOutputItem,
  reasoningOutputItem,
  responseToolCallOutputItem,
  toResponsesUsage,
} from "./translate-response.js";
import { fetchTogetherChat } from "./together-call.js";
import { recordUsage } from "./usage.js";
import type {
  ChatMessage,
  ChatResponse,
  ChatStreamChunk,
  CodexToolTranslation,
  PendingToolCall,
  ResponsesRequest,
  StreamOutputState,
  StreamProxyResult,
} from "./wire-types.js";

const MAX_TOGETHER_STREAM_IDLE_RETRIES = 3;
// Two minutes: allow slow reasoning gaps without treating the upstream stream as dead.
const DEFAULT_CODEX_STREAM_IDLE_TIMEOUT_MS = 120_000;
// Ten minutes: leak protection for a whole streamed Codex turn, not a normal thinking limit.
const DEFAULT_CODEX_STREAM_TURN_TIMEOUT_MS = 600_000;

type StreamTurnResult =
  | {
      ok: true;
      toolCalls: PendingToolCall[];
      usage?: ChatResponse["usage"];
      reasoningText: string;
      text: string;
      finishReason?: string | null | undefined;
    }
  | { ok: false; status: number; error: string };

type SseTimeoutKind = "idle" | "turn";

class SseIdleTimeoutError extends Error {
  constructor(
    readonly timeoutMs: number,
    readonly kind: SseTimeoutKind = "idle",
  ) {
    super(
      kind === "turn"
        ? `Together stream exceeded maximum turn duration of ${timeoutMs}ms.`
        : `Together stream produced no SSE event for ${timeoutMs}ms.`,
    );
    this.name = "SseIdleTimeoutError";
  }
}

type CodexStreamOptions = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
};
export async function streamResponseFromTogether(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexStreamOptions,
  payload: Record<string, unknown>,
  toolTranslation: CodexToolTranslation,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<StreamProxyResult> {
  const responseId = `resp_${randomUUID().replaceAll("-", "")}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  writeResponsesSse(res, "response.created", {
    type: "response.created",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "in_progress",
      model: body.model ?? options.modelId,
      output: [],
    },
  });
  writeResponsesSse(res, "response.in_progress", {
    type: "response.in_progress",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "in_progress",
      model: body.model ?? options.modelId,
      output: [],
    },
  });

  const outputState: StreamOutputState = {
    nextOutputIndex: 0,
    reasoningText: "",
    text: "",
  };

  if (toolTranslation.nativeTools.length > 0) {
    return streamResponseWithNativeTools(
      res,
      body,
      options,
      payload,
      toolTranslation,
      modelDefinition,
      outputState,
      responseId,
      signal,
      perf,
    );
  }

  let turn: StreamTurnResult;
  try {
    turn = await streamTogetherTurnWithIdleRetries(
      res,
      body,
      options,
      payload,
      toolTranslation,
      modelDefinition,
      outputState,
      signal,
      perf,
    );
  } catch (err) {
    if (err instanceof TogetherSsePrematureCloseError) {
      return failStream(res, responseId, 502, err.message);
    }
    if (
      err instanceof SseIdleTimeoutError ||
      err instanceof TogetherSseIdleTimeoutError ||
      err instanceof TogetherResponseHeaderTimeoutError
    ) {
      return failStream(res, responseId, 504, err.message);
    }
    if (err instanceof TogetherSseRetryResponseError) {
      return failStream(
        res,
        responseId,
        err.response.status,
        `Together SSE retry returned ${err.response.status}: ${(await err.response.text()).slice(0, 1000)}`,
      );
    }
    throw err;
  }
  if (!turn.ok) {
    return failStream(res, responseId, turn.status, turn.error);
  }
  return completeStreamResponse(
    res,
    body,
    options,
    responseId,
    outputState,
    turn.toolCalls,
    turn.usage,
    modelDefinition,
    toolTranslation,
    turn.finishReason,
  );
}

async function streamTogetherTurn(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexStreamOptions,
  payload: Record<string, unknown>,
  toolTranslation: CodexToolTranslation,
  modelDefinition: ModelDefinition,
  outputState: StreamOutputState,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<StreamTurnResult> {
  const upstreamResult = await (perf?.span(
    "upstream_fetch",
    () => fetchTogetherChat(payload, options, modelDefinition, signal),
    { stream: true },
  ) ?? fetchTogetherChat(payload, options, modelDefinition, signal));
  if (!upstreamResult.ok) {
    const message = `Together API returned ${upstreamResult.status}: ${upstreamResult.text.slice(0, 1000)}`;
    return { ok: false, status: upstreamResult.status, error: message };
  }
  const upstream = upstreamResult.response;
  if (!upstream.body) {
    const message = "Together returned no stream body.";
    return { ok: false, status: 500, error: message };
  }

  const toolCalls = new Map<number, PendingToolCall>();
  let usage: ChatResponse["usage"] | undefined;
  let reasoningText = "";
  let text = "";
  let finishReason: string | null | undefined;
  const turnStartedAt = Date.now();
  let lastProgressAt = Date.now();
  const progressTimeoutMs = codexStreamIdleTimeoutMs();
  const turnTimeoutMs = codexStreamTurnTimeoutMs();
  let streamAttempt = 0;

  for await (const eventData of readTogetherSseWithRetry(
    upstream,
    async () => {
      const retried = await fetchTogetherChat(payload, options, modelDefinition, signal);
      return retried.ok
        ? retried.response
        : new Response(retried.text, {
            status: retried.status,
            headers: { "content-type": "application/json" },
          });
    },
    {
      isOutputStarted: () => streamOutputStarted(outputState),
      onRetry: ({ attempt, maxRetries, timeoutMs }) =>
        debugLog(options, "retrying together stream after idle timeout", {
          attempt,
          maxRetries,
          model: payload.model,
          timeoutMs,
        }),
    },
  )) {
    if (eventData.attempt !== streamAttempt) {
      streamAttempt = eventData.attempt;
      toolCalls.clear();
      usage = undefined;
      reasoningText = "";
      text = "";
      finishReason = undefined;
      lastProgressAt = Date.now();
    }
    const chunk = eventData.data;
    assertStreamTurnDuration(turnStartedAt, turnTimeoutMs);
    if (chunk === "[DONE]") {
      break;
    }
    let parsed: ChatStreamChunk;
    try {
      parsed = JSON.parse(chunk) as ChatStreamChunk;
    } catch {
      continue;
    }
    let madeProgress = false;
    if (parsed.usage) {
      usage = parsed.usage;
      madeProgress = true;
    }
    const choice = parsed.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = choice?.delta;
    if (!delta) {
      assertStreamProgress(lastProgressAt, progressTimeoutMs);
      continue;
    }
    const reasoningDelta = delta.reasoning ?? delta.reasoning_content;
    if (reasoningDelta) {
      madeProgress = true;
      perf?.markOnce("first_delta", { kind: "reasoning" });
      openReasoningOutputItem(res, outputState);
      outputState.reasoningText += reasoningDelta;
      reasoningText += reasoningDelta;
      writeResponsesSse(res, "response.reasoning_text.delta", {
        type: "response.reasoning_text.delta",
        item_id: outputState.reasoningItemId,
        output_index: outputState.reasoningOutputIndex,
        content_index: 0,
        delta: reasoningDelta,
      });
    }
    if (delta.content) {
      madeProgress = true;
      perf?.markOnce("first_delta", { kind: "text" });
      openTextOutputItem(res, outputState);
      outputState.text += delta.content;
      text += delta.content;
      writeResponsesSse(res, "response.output_text.delta", {
        type: "response.output_text.delta",
        item_id: outputState.textItemId,
        output_index: outputState.textOutputIndex,
        content_index: 0,
        delta: delta.content,
      });
    }
    for (const toolCall of delta.tool_calls ?? []) {
      if (toolCall.id || toolCall.function?.name || toolCall.function?.arguments) {
        madeProgress = true;
        perf?.markOnce("first_delta", { kind: "tool_call" });
      }
      const index = toolCall.index ?? 0;
      const current = toolCalls.get(index) ?? {
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        name: "",
        arguments: "",
      };
      if (toolCall.id) {
        current.id = toolCall.id;
      }
      if (toolCall.function?.name) {
        current.name += toolCall.function.name;
      }
      if (toolCall.function?.arguments) {
        current.arguments += toolCall.function.arguments;
      }
      toolCalls.set(index, current);
    }
    if (madeProgress) {
      lastProgressAt = Date.now();
    } else {
      assertStreamProgress(lastProgressAt, progressTimeoutMs);
    }
  }

  if (!finishReason) {
    return { ok: false, status: 502, error: "Together stream ended without a finish reason." };
  }

  return { ok: true, toolCalls: [...toolCalls.values()], usage, reasoningText, text, finishReason };
}

function assertStreamProgress(lastProgressAt: number, timeoutMs: number): void {
  if (Date.now() - lastProgressAt > timeoutMs) {
    throw new SseIdleTimeoutError(timeoutMs);
  }
}

function assertStreamTurnDuration(startedAt: number, timeoutMs: number): void {
  if (Date.now() - startedAt > timeoutMs) {
    throw new SseIdleTimeoutError(timeoutMs, "turn");
  }
}

async function streamResponseWithNativeTools(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexStreamOptions,
  payload: Record<string, unknown>,
  toolTranslation: CodexToolTranslation,
  modelDefinition: ModelDefinition,
  outputState: StreamOutputState,
  responseId: string,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<StreamProxyResult> {
  const messages = Array.isArray(payload.messages)
    ? ([...(payload.messages as ChatMessage[])] as ChatMessage[])
    : [];
  const nativeToolNames = new Set(toolTranslation.nativeTools.map((tool) => tool.modelName));
  const nativeToolUses = new Map<string, number>();
  let usage: ChatResponse["usage"] | undefined;
  let lastFinishReason: string | null | undefined;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    let turn: StreamTurnResult;
    try {
      turn = await streamTogetherTurnWithIdleRetries(
        res,
        body,
        options,
        { ...payload, messages, stream: true, stream_options: { include_usage: true } },
        toolTranslation,
        modelDefinition,
        outputState,
        signal,
        perf,
      );
    } catch (err) {
      if (err instanceof TogetherSsePrematureCloseError) {
        return failStream(res, responseId, 502, err.message);
      }
      if (
        err instanceof SseIdleTimeoutError ||
        err instanceof TogetherSseIdleTimeoutError ||
        err instanceof TogetherResponseHeaderTimeoutError
      ) {
        return failStream(res, responseId, 504, err.message);
      }
      if (err instanceof TogetherSseRetryResponseError) {
        return failStream(
          res,
          responseId,
          err.response.status,
          `Together SSE retry returned ${err.response.status}: ${(await err.response.text()).slice(0, 1000)}`,
        );
      }
      throw err;
    }
    if (!turn.ok) {
      return failStream(res, responseId, turn.status, turn.error);
    }
    usage = mergeUsage(usage, turn.usage);
    lastFinishReason = turn.finishReason;
    const nativeToolCalls = turn.toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.name));
    if (nativeToolCalls.length === 0) {
      return completeStreamResponse(
        res,
        body,
        options,
        responseId,
        outputState,
        turn.toolCalls,
        usage,
        modelDefinition,
        toolTranslation,
        turn.finishReason,
      );
    }

    const assistantToolCalls = turn.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: "function" as const,
      function: {
        name: toolCall.name || "tool",
        arguments: toolCall.arguments || "{}",
      },
    }));
    const nativeResultMessages = await runNativeToolCalls(
      nativeToolCalls,
      nativeToolUses,
      toolTranslation,
      options,
    );

    if (nativeToolCalls.length !== turn.toolCalls.length) {
      const nativeText = nativeResultMessages
        .map(
          (message) =>
            `Native ${toolTranslation.mappings.get(message.name)?.sourceName ?? message.name} result:\n${message.content}`,
        )
        .join("\n\n");
      if (nativeText) {
        openTextOutputItem(res, outputState);
        const delta = `${outputState.text ? "\n\n" : ""}${nativeText}`;
        outputState.text += delta;
        writeResponsesSse(res, "response.output_text.delta", {
          type: "response.output_text.delta",
          item_id: outputState.textItemId,
          output_index: outputState.textOutputIndex,
          content_index: 0,
          delta,
        });
      }
      const clientToolCalls = turn.toolCalls.filter(
        (toolCall) => !nativeToolNames.has(toolCall.name),
      );
      return completeStreamResponse(
        res,
        body,
        options,
        responseId,
        outputState,
        clientToolCalls,
        usage,
        modelDefinition,
        toolTranslation,
        turn.finishReason,
      );
    }

    messages.push({
      role: "assistant",
      content: turn.text || null,
      tool_calls: assistantToolCalls,
      ...(turn.reasoningText ? { reasoning_content: turn.reasoningText } : {}),
    });
    for (const result of nativeResultMessages) {
      messages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }
  }

  openTextOutputItem(res, outputState);
  const fallback =
    "I could not complete native web search because the model kept requesting additional search tool calls.";
  outputState.text += fallback;
  writeResponsesSse(res, "response.output_text.delta", {
    type: "response.output_text.delta",
    item_id: outputState.textItemId,
    output_index: outputState.textOutputIndex,
    content_index: 0,
    delta: fallback,
  });
  return completeStreamResponse(
    res,
    body,
    options,
    responseId,
    outputState,
    [],
    usage,
    modelDefinition,
    toolTranslation,
    lastFinishReason,
  );
}

async function streamTogetherTurnWithIdleRetries(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexStreamOptions,
  payload: Record<string, unknown>,
  toolTranslation: CodexToolTranslation,
  modelDefinition: ModelDefinition,
  outputState: StreamOutputState,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<StreamTurnResult> {
  const maxRetries = codexStreamIdleRetries();
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await streamTogetherTurn(
        res,
        body,
        options,
        payload,
        toolTranslation,
        modelDefinition,
        outputState,
        signal,
        perf,
      );
    } catch (err) {
      if (
        !(err instanceof SseIdleTimeoutError) ||
        streamOutputStarted(outputState) ||
        attempt >= maxRetries
      ) {
        throw err;
      }
      debugLog(options, "retrying together stream after idle timeout", {
        attempt,
        maxRetries,
        model: payload.model,
        timeoutMs: err.timeoutMs,
      });
      await sleep(backoffMs(attempt));
    }
  }
  throw new SseIdleTimeoutError(codexStreamIdleTimeoutMs());
}

function streamOutputStarted(outputState: StreamOutputState): boolean {
  return outputState.reasoningItemId !== undefined || outputState.textItemId !== undefined;
}

async function runNativeToolCalls(
  nativeToolCalls: PendingToolCall[],
  nativeToolUses: Map<string, number>,
  toolTranslation: CodexToolTranslation,
  options: CodexStreamOptions,
): Promise<Array<{ id: string; name: string; content: string }>> {
  const results: Array<{ id: string; name: string; content: string }> = [];
  for (const toolCall of nativeToolCalls) {
    const name = toolCall.name || "web_search";
    const nativeTool = toolTranslation.mappings.get(name);
    const input = parseJsonOrEmpty(toolCall.arguments);
    const priorUses = nativeToolUses.get(name) ?? 0;
    const webSearchDefinition =
      nativeTool?.kind === "web_search" ? nativeTool.definition : undefined;
    const maxUses =
      webSearchDefinition !== undefined ? codexNativeToolMaxUses(webSearchDefinition) : 0;
    const content = await runNativeWebSearchCall({
      name,
      priorUses,
      maxUses,
      isWebSearch: webSearchDefinition !== undefined,
      recordUse: () => nativeToolUses.set(name, priorUses + 1),
      runSearch: () => runCodexExaSearch(input, webSearchDefinition!, options),
    });
    results.push({ id: toolCall.id, name, content });
  }
  return results;
}

function completeOpenOutputItems(res: ServerResponse, outputState: StreamOutputState): void {
  if (outputState.reasoningItemId !== undefined) {
    writeResponsesSse(res, "response.reasoning_text.done", {
      type: "response.reasoning_text.done",
      item_id: outputState.reasoningItemId,
      output_index: outputState.reasoningOutputIndex,
      content_index: 0,
      text: outputState.reasoningText,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.reasoningOutputIndex,
      item: reasoningOutputItem(outputState.reasoningText, outputState.reasoningItemId),
    });
  }

  if (outputState.textItemId !== undefined) {
    writeResponsesSse(res, "response.output_text.done", {
      type: "response.output_text.done",
      item_id: outputState.textItemId,
      output_index: outputState.textOutputIndex,
      content_index: 0,
      text: outputState.text,
    });
    writeResponsesSse(res, "response.content_part.done", {
      type: "response.content_part.done",
      item_id: outputState.textItemId,
      output_index: outputState.textOutputIndex,
      content_index: 0,
      part: { type: "output_text", text: outputState.text, annotations: [] },
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.textOutputIndex,
      item: messageOutputItem(outputState.text, outputState.textItemId),
    });
  }
}

function completeStreamResponse(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexStreamOptions,
  responseId: string,
  outputState: StreamOutputState,
  toolCalls: PendingToolCall[],
  usage: ChatResponse["usage"],
  modelDefinition: ModelDefinition,
  toolTranslation: CodexToolTranslation,
  finishReason?: string | null,
): StreamProxyResult {
  completeOpenOutputItems(res, outputState);
  let outputIndex = outputState.nextOutputIndex;
  for (const toolCall of toolCalls) {
    const item = responseToolCallOutputItem(toolCall, toolTranslation);
    writeResponsesSse(res, "response.output_item.added", {
      type: "response.output_item.added",
      output_index: outputIndex,
      item,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputIndex,
      item,
    });
    outputIndex += 1;
  }

  if (usage) {
    recordUsage(usage, options, modelDefinition);
  }
  // When the model hit max_tokens (finish_reason "length"), the response is
  // truncated — emit status "incomplete" with incomplete_details so Codex
  // knows the turn was cut short instead of silently treating it as a
  // successful completion. This prevents the "model says one sentence then
  // stops" bug where a truncated turn looked like a finished turn.
  const isLengthTruncated = finishReason === "length";
  writeResponsesSse(res, "response.completed", {
    type: "response.completed",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: isLengthTruncated ? "incomplete" : "completed",
      model: body.model ?? options.modelId,
      output: [
        ...(outputState.reasoningItemId !== undefined
          ? [reasoningOutputItem(outputState.reasoningText, outputState.reasoningItemId)]
          : []),
        ...(outputState.textItemId !== undefined
          ? [messageOutputItem(outputState.text, outputState.textItemId)]
          : []),
        ...[...toolCalls.values()].map((toolCall) =>
          responseToolCallOutputItem(toolCall, toolTranslation),
        ),
      ],
      usage: toResponsesUsage(usage),
      ...(isLengthTruncated ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    },
  });
  res.end();
  return { ok: true, status: res.statusCode };
}

function failStream(
  res: ServerResponse,
  responseId: string,
  status: number,
  message: string,
): StreamProxyResult {
  writeResponsesSse(res, "response.failed", {
    type: "response.failed",
    response: { id: responseId, status: "failed" },
    error: { message },
  });
  res.end();
  return { ok: false, status, error: message };
}

function mergeUsage(
  current: ChatResponse["usage"] | undefined,
  next: ChatResponse["usage"] | undefined,
): ChatResponse["usage"] | undefined {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  const cachedTokens =
    (current.prompt_tokens_details?.cached_tokens ?? current.cached_tokens ?? 0) +
    (next.prompt_tokens_details?.cached_tokens ?? next.cached_tokens ?? 0);
  const reasoningTokens =
    (current.completion_tokens_details?.reasoning_tokens ?? current.reasoning_tokens ?? 0) +
    (next.completion_tokens_details?.reasoning_tokens ?? next.reasoning_tokens ?? 0);
  return {
    prompt_tokens: (current.prompt_tokens ?? 0) + (next.prompt_tokens ?? 0),
    completion_tokens: (current.completion_tokens ?? 0) + (next.completion_tokens ?? 0),
    total_tokens: (current.total_tokens ?? 0) + (next.total_tokens ?? 0),
    cached_tokens: cachedTokens,
    reasoning_tokens: reasoningTokens,
    prompt_tokens_details: { cached_tokens: cachedTokens },
    completion_tokens_details: { reasoning_tokens: reasoningTokens },
  };
}

function codexStreamIdleTimeoutMs(): number {
  const raw =
    process.env.TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS ??
    process.env.TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(100, parsed)
    : DEFAULT_CODEX_STREAM_IDLE_TIMEOUT_MS;
}

function codexStreamTurnTimeoutMs(): number {
  const raw = process.env.TOGETHERLINK_CODEX_STREAM_TURN_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(100, parsed)
    : DEFAULT_CODEX_STREAM_TURN_TIMEOUT_MS;
}

function codexStreamIdleRetries(): number {
  const raw = process.env.TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : MAX_TOGETHER_STREAM_IDLE_RETRIES;
}

function debugLog(
  options: CodexStreamOptions,
  label: string,
  payload: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
