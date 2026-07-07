import { randomUUID } from "node:crypto";
import { type ServerResponse } from "node:http";
import { type ModelDefinition } from "@togetherlink/models";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { type ProxyPerfTracer } from "../proxy-perf.js";
import { consumeSseLines, writeSse } from "../sse.js";
import { postChatCompletionStream } from "../together-client.js";
import { CostTracker } from "../cost.js";
import {
  APPROX_CHARS_PER_TOKEN,
  applyEstimatedContextBudget,
  clampRequestedMaxTokens,
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
  modelId: string;
  targetModelId: string;
  modelDefinition: ModelDefinition;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
  /** Raw byte length of the inbound Anthropic-JSON request body, from readJsonBodyWithSize. */
  rawBytes?: number | undefined;
};

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
    const reasoningEffort = togetherReasoningEffort(body, targetModel.definition);
    const maxTokens = clampRequestedMaxTokens(body.max_tokens, targetModel.definition);
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
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    chat_template_kwargs: { clear_thinking: false },
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
    writeAnthropicError(res, 503, "overloaded_error", message);
    return { ok: false, status: 503, error: message };
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
            perf?.markOnce("first_delta", { kind: "thinking" });
            blockManager.emitThinking(reasoning);
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
  options: ClaudeStreamOptions;
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
