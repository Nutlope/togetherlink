import type { AnthropicContentBlock, AnthropicMessagesRequest } from "./wire-types.js";

const CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 32_000;
const DEFAULT_COMPACTION_MAX_OUTPUT_TOKENS = 16_000;

const COMPACTION_SIGNATURES = [
  "CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.",
  "Your entire response must be plain text: an <analysis> block followed by a <summary> block.",
  "Your task is to create a detailed summary of the conversation so far",
] as const;

export type ClaudeCompactionTuningResult = {
  detected: boolean;
  requestedMaxTokens?: number | undefined;
  maxTokens?: number | undefined;
  userConfiguredClaudeMaxOutputTokens: boolean;
};

export function tuneClaudeCompactionRequest(
  body: AnthropicMessagesRequest,
  options: {
    claudeCodeMaxOutputTokens?: number | undefined;
    userConfiguredClaudeMaxOutputTokens?: boolean | undefined;
  } = {},
): ClaudeCompactionTuningResult {
  if (!isClaudeCompactionRequest(body)) {
    return { detected: false, userConfiguredClaudeMaxOutputTokens: false };
  }

  const requestedMaxTokens = finiteTokenCount(body.max_tokens);
  const claudeCodeMaxOutputTokens =
    finiteTokenCount(options.claudeCodeMaxOutputTokens) ?? CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS;
  const userConfiguredClaudeMaxOutputTokens = options.userConfiguredClaudeMaxOutputTokens === true;
  const effectiveRequestedMaxTokens = requestedMaxTokens ?? claudeCodeMaxOutputTokens;
  const maxTokens = userConfiguredClaudeMaxOutputTokens
    ? Math.min(effectiveRequestedMaxTokens, claudeCodeMaxOutputTokens)
    : Math.min(effectiveRequestedMaxTokens, DEFAULT_COMPACTION_MAX_OUTPUT_TOKENS);

  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
    appendCompactionBudgetInstruction(body, maxTokens, userConfiguredClaudeMaxOutputTokens);
  }

  return {
    detected: true,
    requestedMaxTokens,
    maxTokens,
    userConfiguredClaudeMaxOutputTokens,
  };
}

export function isClaudeCompactionRequest(body: AnthropicMessagesRequest): boolean {
  const lastUserText = lastUserMessageText(body);
  return COMPACTION_SIGNATURES.every((signature) => lastUserText.includes(signature));
}

function appendCompactionBudgetInstruction(
  body: AnthropicMessagesRequest,
  maxTokens: number,
  userConfiguredClaudeMaxOutputTokens: boolean,
): void {
  const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    return;
  }

  const instruction =
    "\n\nTogetherlink compaction compatibility instruction: finish the complete " +
    `<analysis> and <summary> response under ${maxTokens} output tokens. ` +
    "Keep <analysis> brief, put durable handoff details in <summary>, summarize large tool " +
    "outputs and code blocks unless they are essential, and finish cleanly instead of exhausting " +
    "the token limit." +
    (userConfiguredClaudeMaxOutputTokens
      ? " The user configured CLAUDE_CODE_MAX_OUTPUT_TOKENS, so honor that configured budget."
      : "");

  if (typeof lastUser.content === "string") {
    if (!lastUser.content.includes("Togetherlink compaction compatibility instruction:")) {
      lastUser.content += instruction;
    }
    return;
  }

  if (Array.isArray(lastUser.content)) {
    const hasInstruction = lastUser.content.some(
      (block) =>
        block.type === "text" &&
        typeof block.text === "string" &&
        block.text.includes("Togetherlink compaction compatibility instruction:"),
    );
    if (!hasInstruction) {
      lastUser.content.push({ type: "text", text: instruction });
    }
  }
}

function lastUserMessageText(body: AnthropicMessagesRequest): string {
  const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user");
  return lastUser ? contentText(lastUser.content) : "";
}

function contentText(content: string | AnthropicContentBlock[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("\n");
}

function finiteTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : undefined;
}
