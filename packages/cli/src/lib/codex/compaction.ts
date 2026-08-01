import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { ModelDefinition } from "@togetherlink/models";
import { writeResponsesSse } from "./sse.js";
import type { ResponsesInputItem, ResponsesRequest } from "./wire-types.js";

// This is a versioned, reversible TogetherLink encoding, not OpenAI encryption.
const COMPACTION_PREFIX = "tlc1:";
const COMPACTION_MAX_OUTPUT_TOKENS = 8_192;
const V1_RECENT_USER_BUDGET = 80_000;
const SUMMARY_PREFIX =
  "Another language model started this task and produced a continuation summary. Use it to continue without repeating completed work:";

const COMPACTION_PROMPT = `You are performing a context checkpoint compaction. Write a durable handoff summary for another language model that will resume the task.

Retain current progress, key decisions, constraints, user preferences, remaining work, and critical data or references. Be concise, structured, and focused on seamless continuation. Do not call tools.`;

export function isTogetherCompactionV2(body: ResponsesRequest): boolean {
  return Array.isArray(body.input) && body.input.at(-1)?.type === "compaction_trigger";
}

export function compactionInput(body: ResponsesRequest): ResponsesRequest["input"] {
  if (!Array.isArray(body.input)) {
    return body.input;
  }
  return body.input.filter((item) => item.type !== "compaction_trigger");
}

export function normalizeTogetherCompactionItem(
  item: ResponsesInputItem,
): ResponsesInputItem | undefined {
  if (item.type === "compaction_trigger") {
    return undefined;
  }
  if (item.type !== "compaction") {
    return item;
  }
  const summary = decodeSummary(item.encrypted_content);
  return summary === undefined
    ? {
        type: "message",
        role: "user",
        content: "[Earlier conversation history was compacted in an unreadable OpenAI format.]",
      }
    : continuationMessage(summary);
}

export function normalizeNativeCompactionInput(
  input: NonNullable<ResponsesRequest["input"]>,
): NonNullable<ResponsesRequest["input"]> {
  if (!Array.isArray(input)) {
    return input;
  }
  return input.map((item) => {
    if (item.type === "reasoning") {
      return sanitizeReasoningForNative(item);
    }
    if (item.type !== "compaction") {
      return item;
    }
    const summary = decodeSummary(item.encrypted_content);
    return summary === undefined ? item : continuationMessage(summary);
  });
}

function sanitizeReasoningForNative(item: ResponsesInputItem): ResponsesInputItem {
  if (
    item.encrypted_content === undefined ||
    (item.encrypted_content.length > 0 && !/\s/.test(item.encrypted_content))
  ) {
    return item;
  }
  const { encrypted_content: _foreignPlaintext, ...sanitized } = item;
  return sanitized;
}

export function toTogetherCompactionPayload(
  translatedPayload: Record<string, unknown>,
  modelDefinition: ModelDefinition,
): Record<string, unknown> {
  const messages = Array.isArray(translatedPayload.messages) ? [...translatedPayload.messages] : [];
  messages.push({ role: "user", content: COMPACTION_PROMPT });
  return {
    ...translatedPayload,
    messages,
    max_tokens: Math.min(COMPACTION_MAX_OUTPUT_TOKENS, modelDefinition.limit.output),
    tools: [],
    tool_choice: "none",
    stream: false,
  };
}

export function compactionSummary(chatResponse: {
  choices?: Array<{ message?: { content?: string | null } }>;
}): string {
  const summary = chatResponse.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("Together returned an empty compaction summary.");
  }
  return summary;
}

export function togetherCompactionResponse(
  model: string,
  summary: string,
): Record<string, unknown> {
  return compactionSnapshot(model, [compactionItem(summary)]);
}

export function togetherV1CompactOutput(
  input: ResponsesRequest["input"],
  summary: string,
): { output: Array<Record<string, unknown>> } {
  const selected: string[] = [];
  let remaining = V1_RECENT_USER_BUDGET;
  const userMessages = extractUserMessages(input);
  for (let index = userMessages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const text = userMessages[index] ?? "";
    if (text.length <= remaining) {
      selected.push(text);
      remaining -= text.length;
    } else {
      selected.push(text.slice(text.length - remaining));
      remaining = 0;
    }
  }
  selected.reverse();
  return {
    output: [
      ...selected.map(messageItem),
      messageItem(`${SUMMARY_PREFIX}\n\n${summary || "(no summary available)"}`),
    ],
  };
}

export function writeTogetherCompactionSse(
  res: ServerResponse,
  model: string,
  summary: string,
): void {
  const item = compactionItem(summary);
  const responseId = `resp_${randomUUID().replaceAll("-", "")}`;
  const createdAt = Math.floor(Date.now() / 1_000);
  const created = compactionSnapshot(model, [], "in_progress", responseId, createdAt);
  const completed = compactionSnapshot(model, [item], "completed", responseId, createdAt);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.socket?.setNoDelay(true);
  writeResponsesSse(res, "response.created", { type: "response.created", response: created });
  writeResponsesSse(res, "response.output_item.done", {
    type: "response.output_item.done",
    output_index: 0,
    item,
  });
  writeResponsesSse(res, "response.completed", {
    type: "response.completed",
    response: completed,
  });
  res.end();
}

function compactionItem(summary: string): Record<string, unknown> {
  return {
    type: "compaction",
    id: `cmp_${randomUUID().replaceAll("-", "")}`,
    encrypted_content: encodeSummary(summary),
  };
}

function compactionSnapshot(
  model: string,
  output: Array<Record<string, unknown>>,
  status = "completed",
  id = `resp_${randomUUID().replaceAll("-", "")}`,
  createdAt = Math.floor(Date.now() / 1_000),
): Record<string, unknown> {
  return {
    id,
    object: "response",
    created_at: createdAt,
    status,
    model,
    output,
    usage: null,
  };
}

function encodeSummary(summary: string): string {
  return COMPACTION_PREFIX + Buffer.from(summary, "utf8").toString("base64");
}

function decodeSummary(value: string | undefined): string | undefined {
  if (typeof value !== "string" || !value.startsWith(COMPACTION_PREFIX)) {
    return undefined;
  }
  try {
    const encoded = value.slice(COMPACTION_PREFIX.length);
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      return undefined;
    }
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function extractUserMessages(input: ResponsesRequest["input"]): string[] {
  if (!Array.isArray(input)) {
    return typeof input === "string" && input.trim() ? [input] : [];
  }
  return input.flatMap((item) => {
    if (item.type !== undefined && item.type !== "message") {
      return [];
    }
    if (item.role !== "user") {
      return [];
    }
    if (typeof item.content === "string") {
      return item.content.trim() ? [item.content] : [];
    }
    const text = (item.content ?? [])
      .filter((part) => part.type === "input_text" || part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    return text.trim() ? [text] : [];
  });
}

function messageItem(text: string): Record<string, unknown> {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }],
  };
}

function continuationMessage(summary: string): ResponsesInputItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: `${SUMMARY_PREFIX}\n\n${summary}` }],
  };
}
