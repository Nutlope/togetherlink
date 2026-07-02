import { randomUUID } from "node:crypto";
import { type ModelDefinition } from "@togetherlink/models";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { type ProxyPerfTracer } from "../proxy-perf.js";
import { CostTracker } from "./cost.js";
import {
  applyEstimatedContextBudget,
  canTrimInputForContextLengthRetry,
  clampRequestedMaxTokens,
  maxTokensForContextLengthRetry,
  trimPayloadInputForContextLengthRetry,
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
  modelId: string;
  targetModelId: string;
  modelDefinition: ModelDefinition;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
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
    const reasoningEffort = togetherReasoningEffort(body, targetModel.definition);
    let maxTokens = clampRequestedMaxTokens(body.max_tokens, targetModel.definition);
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
    let response = await (perf?.span(
      "upstream_fetch",
      () => fetchTogether(payload, options, signal),
      { turn },
    ) ?? fetchTogether(payload, options, signal));
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
        response = await (perf?.span(
          "upstream_fetch_retry",
          () => fetchTogether(payload, options, signal),
          { turn, reason: "max_tokens" },
        ) ?? fetchTogether(payload, options, signal));
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
          response = await (perf?.span(
            "upstream_fetch_retry",
            () => fetchTogether(payload, options, signal),
            { turn, reason: "trim_context" },
          ) ?? fetchTogether(payload, options, signal));
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
