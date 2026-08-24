import {
  DEEPSEEK_V4_FLASH,
  DEEPSEEK_V4_PRO,
  type ModelReasoningEffort,
} from "@togetherlink/models";
import { resolveTargetModel } from "./translate-response.js";
import type { AnthropicMessagesRequest, ResolvedClaudeModel } from "./wire-types.js";

type ClaudeModelOptions = Parameters<typeof resolveTargetModel>[1];
const AUTO_MODE_VERDICT_SCHEMA_MARKERS = ["<block>yes", "<block>no", "<category>"] as const;
const AUTO_MODE_TRANSCRIPT_ENVELOPE = ["<transcript>", "</transcript>"] as const;

export type ClaudeRequestRoute = {
  targetModel: ResolvedClaudeModel;
  disableReasoning: boolean;
  kind: "auto_mode_classifier" | "standard";
};

type ClaudeReasoningParams =
  | { reasoning: { enabled: false } }
  | { reasoning_effort: ModelReasoningEffort }
  | Record<string, never>;

export function resolveClaudeRequestRoute(
  body: AnthropicMessagesRequest,
  options: ClaudeModelOptions,
): ClaudeRequestRoute {
  const requestedModel = resolveTargetModel(body.model, options);
  if (isClaudeAutoModeClassifierRequest(body, requestedModel)) {
    return {
      targetModel: { alias: DEEPSEEK_V4_FLASH.id, definition: DEEPSEEK_V4_FLASH },
      disableReasoning: true,
      kind: "auto_mode_classifier",
    };
  }
  return {
    targetModel: requestedModel,
    disableReasoning: false,
    kind: "standard",
  };
}

export function resolveClaudeReasoningParams(
  route: ClaudeRequestRoute,
  isCompactionRequest: boolean | undefined,
  reasoningEffort: ModelReasoningEffort | undefined,
): ClaudeReasoningParams {
  if (isCompactionRequest || route.disableReasoning) {
    return { reasoning: { enabled: false } };
  }
  return reasoningEffort ? { reasoning_effort: reasoningEffort } : {};
}

function isClaudeAutoModeClassifierRequest(
  body: AnthropicMessagesRequest,
  requestedModel: ResolvedClaudeModel,
): boolean {
  if (
    requestedModel.definition.id !== DEEPSEEK_V4_PRO.id ||
    body.stream === true ||
    body.tools?.length
  ) {
    return false;
  }
  const system = textContent(body.system);
  const transcript = (body.messages ?? [])
    .map((message) => textContent(message.content))
    .join("\n");
  return (
    AUTO_MODE_VERDICT_SCHEMA_MARKERS.every((marker) => system.includes(marker)) &&
    AUTO_MODE_TRANSCRIPT_ENVELOPE.every((marker) => transcript.includes(marker))
  );
}

function textContent(content: AnthropicMessagesRequest["system"] | undefined): string {
  if (typeof content === "string") {
    return content;
  }
  return (content ?? []).map((block) => (block.type === "text" ? block.text : "")).join("\n");
}
