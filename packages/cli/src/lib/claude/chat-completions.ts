import { randomUUID } from "node:crypto";
import { type ModelDefinition } from "@togetherlink/models";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { type ProxyPerfTracer } from "../proxy-perf.js";
import { CostTracker } from "../cost.js";
import {
  APPROX_CHARS_PER_TOKEN,
  applyEstimatedContextBudget,
  clampClaudeClientMaxTokens,
} from "./context-budget.js";
import { parseJsonOrEmpty } from "./content-format.js";
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
import { resolveTargetModel } from "./translate-response.js";
import { fetchTogether } from "./together-call.js";
import type { AnthropicMessagesRequest, OpenAIChatResponse } from "./wire-types.js";

type ClaudeChatOptions = {
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

export async function callTogetherChatCompletions(
  body: AnthropicMessagesRequest,
  options: ClaudeChatOptions,
  signal?: AbortSignal,
  perf?: ProxyPerfTracer,
): Promise<OpenAIChatResponse> {
  const translated =
    perf?.spanSync("translate_request", () => {
      const targetModel = resolveTargetModel(body.model, options);
      const nativeTools = nativeServerTools(body.tools);
      const messages = toOpenAIMessages(body, targetModel.definition);
      const tools = toOpenAITools(body.tools, options);
      return { targetModel, nativeTools, messages, tools };
    }) ??
    (() => {
      const targetModel = resolveTargetModel(body.model, options);
      const nativeTools = nativeServerTools(body.tools);
      const messages = toOpenAIMessages(body, targetModel.definition);
      const tools = toOpenAITools(body.tools, options);
      return { targetModel, nativeTools, messages, tools };
    })();
  const { targetModel, nativeTools, messages, tools } = translated;
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map<string, number>();

  for (let turn = 0; turn < 5; turn += 1) {
    const reasoningEffort = options.isCompactionRequest
      ? undefined
      : togetherReasoningEffort(body, targetModel.definition);
    const maxTokens = clampClaudeClientMaxTokens(body.max_tokens, targetModel.definition, options);
    const payload = {
      model: targetModel.definition.id,
      messages:
        turn === 0 && nativeTools.length > 0
          ? withClaudeNativeToolSystemPrompt(messages, nativeTools)
          : messages,
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
      stream: false,
    };
    // Estimate input tokens from the inbound raw byte length via the session's
    // calibrated estimator (or rawBytes/4 fallback), instead of re-serializing
    // the translated payload each turn. O(1) far from the window; near the
    // window the clamp path re-stringifies for an exact recount.
    const estimatedInputTokens = estimateInputTokensFromRawBytes(options);
    applyEstimatedContextBudget(
      payload,
      targetModel.definition,
      options,
      "request",
      estimatedInputTokens,
    );
    debugLog(options, "together request", {
      model: payload.model,
      messageCount: payload.messages.length,
      toolCount: payload.tools?.length ?? 0,
      maxTokens: payload.max_tokens,
      reasoningEffort,
      nativeToolCount: nativeTools.length,
      turn,
    });
    // The Together client owns transient (429/503) and reactive context-fit
    // retries (max_tokens → strip old images → trim text → drop oldest turns),
    // so a context-length rejection is self-healed before fetchTogether returns.
    const response = await (perf?.span(
      "upstream_fetch",
      () => fetchTogether(payload, options, targetModel.definition, signal),
      { turn },
    ) ?? fetchTogether(payload, options, targetModel.definition, signal));

    if (!response.ok) {
      // Surfaced via fetchTogether as a TogetherApiError after exhausting retries
      // for transient faults (429/overloaded). Non-retryable, or retries
      // exhausted — map to the matching Anthropic error shape and stop.
      throw response.error;
    }
    const json = response.json;
    if (typeof payload.max_tokens === "number") {
      (
        json as OpenAIChatResponse & { _togetherlinkRequestedMaxTokens?: number }
      )._togetherlinkRequestedMaxTokens = payload.max_tokens;
    }
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
      const maxUses = nativeTool ? claudeNativeToolMaxUses(nativeTool.definition) : 0;
      const result = await runNativeWebSearchCall({
        name,
        priorUses,
        maxUses,
        isWebSearch: nativeTool?.kind === "web_search",
        recordUse: () => nativeToolUses.set(name, priorUses + 1),
        runSearch: () =>
          perf?.span(
            "native_tool",
            () => runClaudeExaSearch(input, nativeTool!.definition, options),
            { name },
          ) ?? runClaudeExaSearch(input, nativeTool!.definition, options),
      });
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

function debugLog(
  options: ClaudeChatOptions,
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
function estimateInputTokensFromRawBytes(options: ClaudeChatOptions): number {
  const rawBytes = options.rawBytes;
  if (typeof rawBytes !== "number" || rawBytes <= 0) {
    return 1;
  }
  if (options.costTracker) {
    return options.costTracker.tokenEstimator.estimate(rawBytes);
  }
  return Math.max(1, Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN));
}
