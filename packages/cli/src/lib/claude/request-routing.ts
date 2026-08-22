import { DEEPSEEK_V4_FLASH } from "@togetherlink/models";
import { resolveTargetModel } from "./translate-response.js";
import type { AnthropicMessagesRequest, ResolvedClaudeModel } from "./wire-types.js";

type ClaudeModelOptions = Parameters<typeof resolveTargetModel>[1];

export type ClaudeRequestRoute = {
  targetModel: ResolvedClaudeModel;
  disableReasoning: boolean;
  kind: "auto_mode_classifier" | "standard";
};

export function resolveClaudeRequestRoute(
  body: AnthropicMessagesRequest,
  options: ClaudeModelOptions,
): ClaudeRequestRoute {
  if (isClaudeAutoModeClassifierRequest(body)) {
    return {
      targetModel: { alias: DEEPSEEK_V4_FLASH.id, definition: DEEPSEEK_V4_FLASH },
      disableReasoning: true,
      kind: "auto_mode_classifier",
    };
  }
  return {
    targetModel: resolveTargetModel(body.model, options),
    disableReasoning: false,
    kind: "standard",
  };
}

function isClaudeAutoModeClassifierRequest(body: AnthropicMessagesRequest): boolean {
  if (body.stream === true || body.tools?.length) {
    return false;
  }
  const system = textContent(body.system);
  const transcript = (body.messages ?? [])
    .map((message) => textContent(message.content))
    .join("\n");
  return (
    system.includes("If the action should be blocked:") &&
    system.includes("If the action should be allowed:") &&
    (transcript.includes("Your ENTIRE response MUST begin with <block>") ||
      transcript.includes("Use <thinking> before responding with <block>"))
  );
}

function textContent(content: AnthropicMessagesRequest["system"] | undefined): string {
  if (typeof content === "string") {
    return content;
  }
  return (content ?? []).map((block) => (block.type === "text" ? block.text : "")).join("\n");
}
