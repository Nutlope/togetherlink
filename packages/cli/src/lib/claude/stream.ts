import { randomUUID } from "node:crypto";
import { type ServerResponse } from "node:http";
import { type ModelDefinition } from "@togetherlink/models";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { type ProxyPerfTracer } from "../proxy-perf.js";
import { writeSse } from "../sse.js";
import {
  postChatCompletionStream,
  TogetherResponseHeaderTimeoutError,
} from "../together-client.js";
import {
  readTogetherSseWithRetry,
  TogetherSseIdleTimeoutError,
  TogetherSseRetryResponseError,
} from "../together-stream.js";
import { CostTracker } from "../cost.js";
import {
  APPROX_CHARS_PER_TOKEN,
  applyEstimatedContextBudget,
  clampClaudeClientMaxTokens,
} from "./context-budget.js";
import { mapStopReason, parseJsonOrEmpty } from "./content-format.js";
import {
  nativeServerTools,
  claudeNativeToolMaxUses,
  runClaudeExaSearch,
  toOpenAIMessages,
  toOpenAIToolChoice,
  toOpenAITools,
  togetherReasoningEffort,
  withClaudeNativeToolSystemPrompt,
} from "./translate-request.js";
import { resolveTargetModel, thinkingSignature } from "./translate-response.js";
import { mapTogetherError, writeAnthropicError } from "./together-call.js";
import type {
  AnthropicMessagesRequest,
  NativeServerTool,
  OpenAIMessage,
  StreamProxyResult,
} from "./wire-types.js";

type ClaudeStreamOptions = {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  targetModelId: string;
  modelDefinition: ModelDefinition;
  debug?: boolean | undefined;
  claudeCodeMaxOutputTokens?: number | undefined;
  claudeCodeMaxOutputTokensUserSet?: boolean | undefined;
  isCompactionRequest?: boolean | undefined;
  costTracker?: CostTracker | undefined;
  /** Raw byte length of the inbound Anthropic-JSON request body, from readJsonBodyWithSize. */
  rawBytes?: number | undefined;
};

const CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 32_000;
const CLAUDE_RESPONSE_OUTPUT_HEADROOM_TOKENS = 2_048;
const CLAUDE_THINKING_OUTPUT_MAX_TOKENS = 8_000;

export async function streamAnthropicFromTogether(
  res: ServerResponse,
  body: AnthropicMessagesRequest,
  options: ClaudeStreamOptions,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<StreamProxyResult> {
  // Translate the Anthropic request into the Together/OpenAI chat payload once.
  // The body is extracted into a single local so the translate step is written
  // once and run through the perf tracer when present, or directly otherwise —
  // rather than duplicating the whole translation body across the spanSync and
  // fallback branches. Behavior is unchanged.
  const run = () => {
    const targetModel = resolveTargetModel(body.model, options);
    const messages = toOpenAIMessages(body, targetModel.definition);
    const nativeTools = nativeServerTools(body.tools);
    const upstreamMessages =
      nativeTools.length > 0 ? withClaudeNativeToolSystemPrompt(messages, nativeTools) : messages;
    const tools = toOpenAITools(body.tools, options);
    const reasoningEffort = options.isCompactionRequest
      ? undefined
      : togetherReasoningEffort(body, targetModel.definition);
    const maxTokens = clampClaudeClientMaxTokens(body.max_tokens, targetModel.definition, options);
    return {
      targetModel,
      messages,
      nativeTools,
      upstreamMessages,
      tools,
      reasoningEffort,
      maxTokens,
    };
  };
  const translated = perf ? perf.spanSync("translate_request", run) : run();
  const { targetModel, nativeTools, upstreamMessages, tools, reasoningEffort } = translated;
  const { maxTokens } = translated;

  const payload = {
    model: targetModel.definition.id,
    messages: upstreamMessages,
    max_tokens: maxTokens,
    stop: body.stop_sequences,
    temperature: body.temperature,
    tools,
    tool_choice: toOpenAIToolChoice(body.tool_choice),
    ...(options.isCompactionRequest
      ? { reasoning: { enabled: false } }
      : reasoningEffort
        ? { reasoning_effort: reasoningEffort }
        : {}),
    chat_template_kwargs: { clear_thinking: options.isCompactionRequest === true },
    stream: true,
    // Guarantee Together sends a usage chunk at the end so cost tracking has
    // real token counts (without this, some streamed responses omit usage).
    stream_options: { include_usage: true },
  };
  // Estimate input tokens from the inbound raw byte length via the session's
  // calibrated estimator (or the rawBytes/4 fallback when there is no
  // costTracker), instead of re-serializing the translated payload. This makes
  // the budget check O(1) on the ~95% of turns far from the window.
  const estimatedInputTokens = estimateInputTokensFromRawBytes(options);
  applyEstimatedContextBudget(
    payload,
    targetModel.definition,
    options,
    "stream",
    estimatedInputTokens,
  );

  debugLog(options, "together stream request", {
    model: payload.model,
    messageCount: payload.messages.length,
    toolCount: payload.tools?.length ?? 0,
    maxTokens: payload.max_tokens,
    reasoningEffort,
  });

  // The Together client owns both transient (429/503) and reactive context-fit
  // retries now, so this path just posts once and maps whatever comes back. A
  // context-length rejection is self-healed inside the client (max_tokens →
  // strip old images → trim text → drop oldest turns) before it ever surfaces.
  let response: Response;
  try {
    response = await postTogetherStream(payload, options, signal, perf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof TogetherResponseHeaderTimeoutError;
    writeAnthropicError(
      res,
      timedOut ? 504 : 503,
      timedOut ? "timeout_error" : "overloaded_error",
      message,
    );
    return { ok: false, status: timedOut ? 504 : 503, error: message };
  }

  if (!response.ok) {
    const error = await mapTogetherError(response);
    debugLog(options, "together stream error", {
      status: error.status,
      anthropicType: error.anthropicType,
      code: error.code,
      body: error.message.slice(0, 1000),
    });
    writeAnthropicError(res, error.anthropicStatus, error.anthropicType, error.message);
    return { ok: false, status: error.anthropicStatus, error: error.message };
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
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);

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
    try {
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
    } catch (err) {
      if (err instanceof TogetherSseIdleTimeoutError) {
        return failAnthropicStream(res, 504, "timeout_error", err.message);
      }
      if (err instanceof TogetherSseRetryResponseError) {
        const mapped = await mapTogetherError(err.response);
        return failAnthropicStream(
          res,
          mapped.anthropicStatus,
          mapped.anthropicType,
          mapped.message,
        );
      }
      throw err;
    }
  }

  const blockManager = new StreamBlockManager(res, new StreamOutputBudget(options));
  let stopReason = "end_turn";
  let upstreamFinishReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let streamAttempt = 0;

  try {
    for await (const eventData of readTogetherSseWithRetry(
      response,
      () => postTogetherStream(payload, options, signal, perf, "upstream_fetch_retry"),
      {
        isOutputStarted: () => blockManager.hasOutput(),
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
        upstreamFinishReason = null;
        inputTokens = 0;
        outputTokens = 0;
        cachedTokens = 0;
      }
      const event = parseStreamData(eventData.data);
      if (!event) {
        continue;
      }
      const delta = event.delta;
      if (delta) {
        const reasoning = delta.reasoning ?? delta.reasoning_content;
        if (typeof reasoning === "string" && reasoning.length > 0) {
          if (options.isCompactionRequest) {
            // Some Together reasoning models still place summarization output
            // in reasoning_content when reasoning is explicitly disabled.
            // Claude Code's compactor only accepts assistant text, so expose
            // that provider-specific channel as text for this request type.
            perf?.markOnce("first_delta", { kind: "text" });
            blockManager.emitText(reasoning);
          } else {
            perf?.markOnce("first_delta", { kind: "thinking" });
            blockManager.emitThinking(reasoning);
          }
        }
        if (typeof delta.content === "string" && delta.content.length > 0) {
          perf?.markOnce("first_delta", { kind: "text" });
          blockManager.emitText(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const toolCall of delta.tool_calls) {
            perf?.markOnce("first_delta", { kind: "tool_call" });
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
        upstreamFinishReason = event.finish_reason;
      }
    }
  } catch (err) {
    debugLog(options, "together stream read error", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof TogetherSseIdleTimeoutError) {
      return failAnthropicStream(res, 504, "timeout_error", err.message);
    }
    if (err instanceof TogetherSseRetryResponseError) {
      const mapped = await mapTogetherError(err.response);
      return failAnthropicStream(res, mapped.anthropicStatus, mapped.anthropicType, mapped.message);
    }
    // Mid-stream failure: best-effort close whatever block is open, then end.
    // The client already has partial output; we can't retroactively emit an
    // error event in a way Anthropic SSE expects after content has started.
  }

  stopReason = mapStopReason(upstreamFinishReason, {
    outputTokens,
    requestedMaxTokens: payload.max_tokens as number | undefined,
  });
  // Claude Code automatically continues a response reported as max_tokens.
  // That behavior is useful for normal turns but fatal for compaction: several
  // bounded summary chunks accumulate until Claude Code's own output guard
  // aborts the operation. A compact response is a single bounded handoff, so
  // never invite continuation after Together reaches its summary budget.
  if (options.isCompactionRequest && upstreamFinishReason === "length") {
    stopReason = "end_turn";
  }
  if (upstreamFinishReason === "length" && stopReason !== "max_tokens") {
    debugLog(options, "downgraded short Together length stop", {
      outputTokens,
      requestedMaxTokens: payload.max_tokens,
    });
  }
  blockManager.close();
  if (inputTokens > 0 || outputTokens > 0) {
    options.costTracker?.addUsage(inputTokens, cachedTokens, outputTokens, targetModel.definition);
  }
  debugLog(options, "together stream done", {
    stopReason,
    usage: { inputTokens, outputTokens, cachedTokens },
    blocks: blockManager.summary(),
    outputBudget: blockManager.outputSummary(),
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
  options: ClaudeStreamOptions;
  signal?: AbortSignal;
}): Promise<StreamProxyResult> {
  const blockManager = new StreamBlockManager(res, new StreamOutputBudget(options));
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map<string, number>();
  const messages = initialMessages.slice();
  let response = initialResponse;
  let currentPayload = initialPayload;
  let stopReason = "end_turn";
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  for (let turn = 0; turn < 5; turn += 1) {
    const collected = await collectTogetherStreamTurn(
      response,
      options,
      initialPayload.max_tokens as number | undefined,
      () => postTogetherStream(currentPayload, options, signal),
      () => blockManager.hasOutput(),
    );
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

    const toolResults = await Promise.all(
      nativeToolCalls.map(async (toolCall) => {
        const id = toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`;
        const name = toolCall.function.name ?? "web_search";
        const nativeTool = nativeTools.find((tool) => tool.name === name);
        const input = parseJsonOrEmpty(toolCall.function.arguments);
        const priorUses = nativeToolUses.get(name) ?? 0;
        const maxUses = nativeTool ? claudeNativeToolMaxUses(nativeTool.definition) : 0;
        const result = await runNativeWebSearchCall({
          name,
          priorUses,
          maxUses,
          isWebSearch: nativeTool?.kind === "web_search",
          recordUse: () => nativeToolUses.set(name, priorUses + 1),
          runSearch: () => runClaudeExaSearch(input, nativeTool!.definition, options),
        });
        return { id, result };
      }),
    );
    for (const { id, result } of toolResults) {
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
      nextResponse = await postTogetherStream(nextPayload, options, signal);
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
    currentPayload = nextPayload;
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
    outputBudget: blockManager.outputSummary(),
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

async function postTogetherStream(
  payload: Record<string, unknown>,
  options: ClaudeStreamOptions,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
  spanName = "upstream_fetch",
  spanFields?: Record<string, unknown>,
): Promise<Response> {
  // The client serializes the payload and, on a context-length rejection,
  // repairs it in place and re-posts (see together-client.ts). Passing the
  // model definition enables that reactive context-fit retry.
  const request = () =>
    postChatCompletionStream(payload, options, signal, undefined, {
      modelDefinition: options.modelDefinition,
      debug: options.debug,
    });
  return await (perf?.span(spanName, request, spanFields) ?? request());
}

async function collectTogetherStreamTurn(
  response: Response,
  options: ClaudeStreamOptions,
  requestedMaxTokens?: number | undefined,
  retry: () => Promise<Response> = async () => response,
  isOutputStarted: () => boolean = () => false,
): Promise<CollectedStreamTurn> {
  const toolCalls = new Map<number, CollectedStreamToolCall>();
  let upstreamFinishReason: string | null = null;
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
  let streamAttempt = 0;
  try {
    for await (const eventData of readTogetherSseWithRetry(response, retry, {
      isOutputStarted,
      onRetry: ({ attempt, maxRetries, timeoutMs }) =>
        debugLog(options, "retrying together native stream after idle timeout", {
          attempt,
          maxRetries,
          timeoutMs,
        }),
    })) {
      if (eventData.attempt !== streamAttempt) {
        streamAttempt = eventData.attempt;
        toolCalls.clear();
        upstreamFinishReason = null;
        turn.reasoning = "";
        turn.text = "";
        turn.inputTokens = 0;
        turn.outputTokens = 0;
        turn.cachedTokens = 0;
      }
      const event = parseStreamData(eventData.data);
      if (!event) {
        continue;
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
        upstreamFinishReason = event.finish_reason;
      }
    }
  } catch (err) {
    debugLog(options, "together native stream read error", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  turn.stopReason = mapStopReason(upstreamFinishReason, {
    outputTokens: turn.outputTokens,
    requestedMaxTokens,
  });
  if (upstreamFinishReason === "length" && turn.stopReason !== "max_tokens") {
    debugLog(options, "downgraded short Together native length stop", {
      outputTokens: turn.outputTokens,
      requestedMaxTokens,
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

  constructor(
    private readonly res: ServerResponse,
    private readonly outputBudget: StreamOutputBudget,
  ) {}

  emitThinking(reasoning: string): void {
    const emittedReasoning = this.outputBudget.takeThinking(reasoning);
    if (!emittedReasoning) {
      return;
    }
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
    this.openBlock.reasoning += emittedReasoning;
    writeSse(this.res, "content_block_delta", {
      type: "content_block_delta",
      index: this.openBlock.index,
      delta: { type: "thinking_delta", thinking: emittedReasoning },
    });
  }

  emitText(text: string): void {
    const emittedText = this.outputBudget.takeText(text);
    if (!emittedText) {
      return;
    }
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
      delta: { type: "text_delta", text: emittedText },
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
    const argsFragment = this.outputBudget.takeToolJson(toolCall.function?.arguments ?? "");
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

  hasOutput(): boolean {
    return this.blockCount > 0;
  }

  summary(): string {
    return `${this.blockCount} block(s)`;
  }

  outputSummary(): Record<string, unknown> {
    return this.outputBudget.summary();
  }
}

function failAnthropicStream(
  res: ServerResponse,
  status: number,
  type: string,
  message: string,
): StreamProxyResult {
  writeSse(res, "error", { type: "error", error: { type, message } });
  res.end();
  return { ok: false, status, error: message };
}

class StreamOutputBudget {
  private readonly maxContentChars: number;
  private readonly maxThinkingChars: number;
  private contentChars = 0;
  private thinkingChars = 0;
  private droppedThinkingChars = 0;
  private droppedContentChars = 0;

  constructor(options: ClaudeStreamOptions) {
    const claudeMaxTokens =
      finitePositiveInteger(options.claudeCodeMaxOutputTokens) ??
      CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS;
    const safeContentTokens = Math.max(1, claudeMaxTokens - CLAUDE_RESPONSE_OUTPUT_HEADROOM_TOKENS);
    this.maxContentChars = safeContentTokens * APPROX_CHARS_PER_TOKEN;
    this.maxThinkingChars =
      Math.min(safeContentTokens, CLAUDE_THINKING_OUTPUT_MAX_TOKENS) * APPROX_CHARS_PER_TOKEN;
  }

  takeThinking(value: string): string {
    return this.take(value, true);
  }

  takeText(value: string): string {
    return this.take(value, false);
  }

  takeToolJson(value: string): string {
    return this.take(value, false);
  }

  summary(): Record<string, unknown> {
    return {
      contentChars: this.contentChars,
      thinkingChars: this.thinkingChars,
      droppedContentChars: this.droppedContentChars,
      droppedThinkingChars: this.droppedThinkingChars,
      maxContentChars: this.maxContentChars,
      maxThinkingChars: this.maxThinkingChars,
    };
  }

  private take(value: string, thinking: boolean): string {
    if (!value) {
      return "";
    }
    const remainingContentChars = this.maxContentChars - this.contentChars;
    const remainingThinkingChars = thinking ? this.maxThinkingChars - this.thinkingChars : Infinity;
    const remaining = Math.max(0, Math.min(remainingContentChars, remainingThinkingChars));
    if (remaining <= 0) {
      this.drop(value.length, thinking);
      return "";
    }
    if (value.length <= remaining) {
      this.contentChars += value.length;
      if (thinking) {
        this.thinkingChars += value.length;
      }
      return value;
    }
    const emitted = value.slice(0, remaining);
    this.contentChars += emitted.length;
    if (thinking) {
      this.thinkingChars += emitted.length;
    }
    this.drop(value.length - emitted.length, thinking);
    return emitted;
  }

  private drop(chars: number, thinking: boolean): void {
    if (thinking) {
      this.droppedThinkingChars += chars;
    } else {
      this.droppedContentChars += chars;
    }
  }
}

function finitePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.floor(value));
}

function debugLog(
  options: ClaudeStreamOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}

/**
 * Estimate input tokens from the inbound request's raw byte length. Uses the
 * session costTracker's calibrated estimator when present; otherwise falls
 * back to rawBytes / APPROX_CHARS_PER_TOKEN (4). Returns a positive integer.
 * O(1) — no payload serialization.
 */
function estimateInputTokensFromRawBytes(options: ClaudeStreamOptions): number {
  const rawBytes = options.rawBytes;
  if (typeof rawBytes !== "number" || rawBytes <= 0) {
    return 1;
  }
  if (options.costTracker) {
    return options.costTracker.tokenEstimator.estimate(rawBytes);
  }
  return Math.max(1, Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN));
}
