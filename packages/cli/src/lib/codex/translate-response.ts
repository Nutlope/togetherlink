import { randomUUID } from "node:crypto";
import { type ServerResponse } from "node:http";
import { writeResponsesSse } from "./sse.js";
import { parseJsonOrEmpty, stringifyUnknown } from "./content-format.js";
import type {
  ChatResponse,
  CodexToolTranslation,
  PendingToolCall,
  ResponsesRequest,
  StreamOutputState,
} from "./wire-types.js";

type CodexResponseOptions = {
  modelId: string;
};

export function toResponsesResponse(
  chatResponse: ChatResponse,
  body: ResponsesRequest,
  options: CodexResponseOptions,
  toolTranslation: CodexToolTranslation,
): Record<string, unknown> {
  const responseId = chatResponse.id ?? `resp_${randomUUID().replaceAll("-", "")}`;
  // When the model hit max_tokens (finish_reason "length"), the response is
  // truncated — emit status "incomplete" with incomplete_details so Codex
  // knows the turn was cut short instead of silently completing.
  const isLengthTruncated = chatResponse.choices?.[0]?.finish_reason === "length";
  return {
    id: responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: isLengthTruncated ? "incomplete" : "completed",
    ...(isLengthTruncated ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    model: body.model ?? options.modelId,
    output: toResponsesOutput(chatResponse, toolTranslation),
    usage: toResponsesUsage(chatResponse.usage),
  };
}

function toResponsesOutput(
  chatResponse: ChatResponse,
  toolTranslation: CodexToolTranslation,
): Record<string, unknown>[] {
  const message = chatResponse.choices?.[0]?.message ?? {};
  const output: Record<string, unknown>[] = [];
  const reasoning = message.reasoning ?? message.reasoning_content;
  if (reasoning) {
    output.push({
      id: `rs_${randomUUID().replaceAll("-", "")}`,
      type: "reasoning",
      summary: [],
      content: [{ type: "reasoning_text", text: reasoning }],
    });
  }
  if (message.content) {
    output.push(messageOutputItem(message.content));
  }
  for (const toolCall of message.tool_calls ?? []) {
    output.push(
      responseToolCallOutputItem(
        {
          id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}",
        },
        toolTranslation,
      ),
    );
  }
  return output;
}

export function openReasoningOutputItem(res: ServerResponse, state: StreamOutputState): void {
  if (state.reasoningItemId !== undefined) {
    return;
  }
  state.reasoningItemId = `rs_${randomUUID().replaceAll("-", "")}`;
  state.reasoningOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: state.reasoningOutputIndex,
    item: {
      id: state.reasoningItemId,
      type: "reasoning",
      status: "in_progress",
      summary: [],
      content: [],
    },
  });
}

export function openTextOutputItem(res: ServerResponse, state: StreamOutputState): void {
  if (state.textItemId !== undefined) {
    return;
  }
  state.textItemId = `msg_${randomUUID().replaceAll("-", "")}`;
  state.textOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  const item = {
    id: state.textItemId,
    type: "message",
    role: "assistant",
    status: "in_progress",
    content: [],
  };
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: state.textOutputIndex,
    item,
  });
  writeResponsesSse(res, "response.content_part.added", {
    type: "response.content_part.added",
    item_id: state.textItemId,
    output_index: state.textOutputIndex,
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  });
}

export function reasoningOutputItem(
  text: string,
  id = `rs_${randomUUID().replaceAll("-", "")}`,
): Record<string, unknown> {
  return {
    id,
    type: "reasoning",
    status: "completed",
    summary: [],
    content: [{ type: "reasoning_text", text }],
  };
}

export function messageOutputItem(
  text: string,
  id = `msg_${randomUUID().replaceAll("-", "")}`,
): Record<string, unknown> {
  return {
    id,
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  };
}

export function responseToolCallOutputItem(
  toolCall: PendingToolCall,
  toolTranslation: CodexToolTranslation,
): Record<string, unknown> {
  const mapping = toolTranslation.mappings.get(toolCall.name);
  if (mapping?.kind === "tool_search") {
    return {
      id: `tsc_${randomUUID().replaceAll("-", "")}`,
      type: "tool_search_call",
      status: "completed",
      call_id: toolCall.id,
      execution: mapping.execution,
      arguments: parseJsonOrEmpty(toolCall.arguments),
    };
  }

  if (mapping?.kind === "custom") {
    const parsed = parseJsonOrEmpty(toolCall.arguments);
    return {
      id: `ctc_${randomUUID().replaceAll("-", "")}`,
      type: "custom_tool_call",
      status: "completed",
      call_id: toolCall.id,
      name: mapping.sourceName,
      input: customToolInput(parsed, toolCall.arguments),
    };
  }

  if (mapping?.kind === "namespace") {
    return {
      id: `fc_${randomUUID().replaceAll("-", "")}`,
      type: "function_call",
      status: "completed",
      call_id: toolCall.id,
      namespace: mapping.namespace,
      name: mapping.sourceName,
      arguments: toolCall.arguments || "{}",
    };
  }

  return functionCallOutputItem({
    ...toolCall,
    name: mapping?.sourceName ?? toolCall.name,
  });
}

function functionCallOutputItem(toolCall: PendingToolCall): Record<string, unknown> {
  return {
    id: `fc_${randomUUID().replaceAll("-", "")}`,
    type: "function_call",
    status: "completed",
    call_id: toolCall.id,
    name: toolCall.name || "tool",
    arguments: toolCall.arguments || "{}",
  };
}

function customToolInput(parsed: unknown, rawArguments: string): string {
  if (typeof parsed === "object" && parsed !== null && "input" in parsed) {
    const input = (parsed as { input?: unknown }).input;
    if (typeof input === "string") {
      return input;
    }
    return stringifyUnknown(input);
  }
  return rawArguments;
}

export function toResponsesUsage(usage: ChatResponse["usage"]): Record<string, unknown> {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const reasoningTokens =
    usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
    output_tokens_details: {
      reasoning_tokens: reasoningTokens,
    },
  };
}
