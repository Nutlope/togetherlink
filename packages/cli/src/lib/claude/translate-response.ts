import { randomUUID } from "node:crypto";
import type { ModelDefinition } from "@togetherlink/models";
import { stableHash } from "../stable-hash.js";
import { CLAUDE_SUPPORTED_MODELS } from "./defaults.js";
import { APPROX_CHARS_PER_TOKEN, jsonByteLength, safeClaudeInputLimit } from "./context-budget.js";
import { mapStopReason, parseJsonOrEmpty } from "./content-format.js";
import type { TokenEstimator } from "../cost.js";
import { toOpenAIMessages } from "./translate-request.js";
import type {
  AnthropicCountTokensRequest,
  OpenAIChatResponse,
  OpenAIMessage,
  ResolvedClaudeModel,
} from "./wire-types.js";

type ClaudeModelOptions = {
  modelId: string;
  targetModelId: string;
  modelDefinition: ModelDefinition;
};

export function thinkingSignature(reasoning: string): string {
  return `togetherlink:${stableHash(reasoning)}`;
}

function asOpenAIMessageRecord(value: unknown): OpenAIMessage | undefined {
  return typeof value === "object" && value !== null ? (value as OpenAIMessage) : undefined;
}

export function resolveTargetModel(
  requestedModel: string | undefined,
  options: ClaudeModelOptions,
): ResolvedClaudeModel {
  const supported = CLAUDE_SUPPORTED_MODELS.find(
    (model) => model.alias === requestedModel || model.definition.id === requestedModel,
  );
  return supported ?? { alias: options.modelId, definition: options.modelDefinition };
}

export function findClaudeModel(
  modelId: string,
  options: ClaudeModelOptions,
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

export function claudeModelResponse(model: ResolvedClaudeModel): Record<string, unknown> {
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
  options?: ClaudeModelOptions,
  rawBytes?: number,
  estimator?: TokenEstimator,
): { input_tokens: number } {
  // Estimate from the inbound request's raw byte size via the same
  // self-calibrating estimator used by the context-budget gate. This avoids
  // re-translating + re-stringifying the whole conversation on an endpoint
  // Claude Code polls routinely, and is calibrated against Together's real
  // tokenizer instead of a fixed ÷4, which improves compaction timing.
  if (typeof rawBytes === "number" && rawBytes > 0) {
    const estimate = estimator?.estimate(rawBytes) ?? Math.ceil(rawBytes / APPROX_CHARS_PER_TOKEN);
    return { input_tokens: Math.max(1, estimate) };
  }
  // Defensive fallback: no raw byte length available (e.g. a direct unit-test
  // call without a sized body read). Fall back to the payload-stringify path so
  // we never return 0 for a real conversation.
  const targetModel = options ? resolveTargetModel(body.model, options).definition : undefined;
  const estimatedBytes = jsonByteLength({
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
  const estimatedTokens = Math.max(1, Math.ceil(estimatedBytes / APPROX_CHARS_PER_TOKEN));
  return {
    input_tokens: estimatedTokens,
  };
}

export function toAnthropicMessage(
  response: OpenAIChatResponse,
  model: string,
): Record<string, unknown> {
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
