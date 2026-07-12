import type { AnthropicContentBlock, AnthropicMessagesRequest } from "./wire-types.js";

const CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

const COMPACTION_SIGNATURES = [
  "CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.",
  "Your entire response must be plain text: an <analysis> block followed by a <summary> block.",
  // Claude Code uses full-history, recent-portion, and continuing-session
  // variants. Their suffix differs, but this stable prefix identifies all of
  // them without tying Togetherlink to one exact release's wording.
  "Your task is to create a detailed summary",
] as const;

const COMPACTION_INSTRUCTION_START = "CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.";

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
  // Preserve Claude Code's own compaction request budget. The client-level
  // limit remains authoritative when the user explicitly configures a lower
  // value, but Togetherlink does not impose a separate compaction-only cap.
  const maxTokens = Math.min(effectiveRequestedMaxTokens, claudeCodeMaxOutputTokens);

  if (maxTokens !== undefined) {
    body.max_tokens = maxTokens;
    rewriteCompactionInstruction(body, maxTokens, userConfiguredClaudeMaxOutputTokens);
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

function rewriteCompactionInstruction(
  body: AnthropicMessagesRequest,
  maxTokens: number,
  userConfiguredClaudeMaxOutputTokens: boolean,
): void {
  const lastUser = [...(body.messages ?? [])].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    return;
  }

  const instruction = boundedCompactionInstruction(maxTokens, userConfiguredClaudeMaxOutputTokens);

  if (typeof lastUser.content === "string") {
    lastUser.content = replaceUnboundedCompactionPrompt(lastUser.content, instruction);
    return;
  }

  if (Array.isArray(lastUser.content)) {
    for (const block of lastUser.content) {
      if (block.type === "text" && typeof block.text === "string") {
        block.text = replaceUnboundedCompactionPrompt(block.text, instruction);
      }
    }
  }
}

function replaceUnboundedCompactionPrompt(text: string, instruction: string): string {
  const index = text.indexOf(COMPACTION_INSTRUCTION_START);
  if (index === -1) {
    return `${text.trimEnd()}\n\n${instruction}`;
  }
  const prefix = text.slice(0, index).trimEnd();
  return prefix ? `${prefix}\n\n${instruction}` : instruction;
}

function boundedCompactionInstruction(
  maxTokens: number,
  userConfiguredClaudeMaxOutputTokens: boolean,
): string {
  return `Togetherlink bounded compaction request:

Respond with plain text only: a short <analysis> block followed by a <summary> block.

Hard budget:
- Finish the entire response under ${maxTokens} output tokens.
- Keep <analysis> under 150 words.
- Close both XML-ish tags. Do not continue until the token limit.

Write a durable handoff summary for continuing the coding task, but keep it bounded:
1. Primary request and current objective.
2. Important technical facts, decisions, and constraints.
3. Files touched/read and why they matter, using paths and concise descriptions.
4. Errors encountered and fixes or current hypotheses.
5. Current work and next concrete step.

Do not list every user message verbatim. Group repeated feedback.
Do not include full tool outputs, full diffs, or full code snippets unless a short snippet is essential.
Prefer precise file paths, commands, test results, and line-level facts over transcript prose.
Preserve security-relevant user constraints verbatim if any exist.
${userConfiguredClaudeMaxOutputTokens ? "The user configured CLAUDE_CODE_MAX_OUTPUT_TOKENS; honor that configured budget while staying concise." : ""}`;
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
