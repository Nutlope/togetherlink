import { trimSearchText } from "../exa-search.js";
import type { AnthropicContentBlock, AnthropicMessagesRequest } from "./wire-types.js";

export function stringifyAnthropicContent(content: AnthropicMessagesRequest["system"]): string {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function stringifyUnknown(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

export function formatToolResultContent(content: unknown, isError?: boolean): string {
  const prefix = isError ? "[tool_result error]\n" : "";
  if (typeof content === "string") {
    return `${prefix}${content}`;
  }
  if (Array.isArray(content)) {
    const parts = content.map(formatContentBlockForToolResult).filter((part) => part.length > 0);
    return `${prefix}${parts.join("\n")}`;
  }
  return `${prefix}${stringifyUnknown(content)}`;
}

function formatContentBlockForToolResult(block: unknown): string {
  if (typeof block !== "object" || block === null) {
    return stringifyUnknown(block);
  }
  const record = block as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  if (record.type === "image") {
    const source =
      typeof record.source === "object" && record.source !== null
        ? (record.source as Record<string, unknown>)
        : {};
    const mediaType = typeof source.media_type === "string" ? ` ${source.media_type}` : "";
    return `[image${mediaType} in tool result]`;
  }
  if (record.type === "url" && typeof record.url === "string") {
    return `[url in tool result] ${record.url}`;
  }
  return stringifyUnknown(block);
}

export function formatWebSearchToolResult(
  block: Extract<
    AnthropicContentBlock,
    { type: "web_search_tool_result" | "web_search_tool_result_error" }
  >,
): string {
  const errorCode = typeof block.error_code === "string" ? block.error_code : undefined;
  if (block.type === "web_search_tool_result_error") {
    return `Web search error${errorCode ? ` (${errorCode})` : ""}: ${formatToolResultContent(block.content)}`;
  }
  const content = block.content;
  if (Array.isArray(content)) {
    const lines = content.flatMap((item, index) => formatWebSearchResultItem(item, index));
    return lines.length > 0 ? lines.join("\n\n") : "Web search returned no results.";
  }
  if (typeof content === "object" && content !== null) {
    const record = content as Record<string, unknown>;
    if (record.type === "web_search_tool_result_error") {
      const code = typeof record.error_code === "string" ? record.error_code : errorCode;
      return `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`;
    }
  }
  return formatToolResultContent(content);
}

function formatWebSearchResultItem(item: unknown, index: number): string[] {
  if (typeof item !== "object" || item === null) {
    return [`${index + 1}. ${stringifyUnknown(item)}`];
  }
  const record = item as Record<string, unknown>;
  if (record.type === "web_search_tool_result_error") {
    const code = typeof record.error_code === "string" ? record.error_code : undefined;
    return [
      `Web search error${code ? ` (${code})` : ""}: ${formatToolResultContent(record.content)}`,
    ];
  }
  const title =
    stringField(record, "title") ?? stringField(record, "page_title") ?? "Untitled result";
  const url = stringField(record, "url") ?? stringField(record, "source");
  const snippet =
    stringField(record, "text") ??
    stringField(record, "snippet") ??
    stringField(record, "description");
  return [
    [
      `${index + 1}. ${title}`,
      ...(url ? [`URL: ${url}`] : []),
      ...(snippet ? [`Snippet: ${trimSearchText(snippet)}`] : []),
    ].join("\n"),
  ];
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function objectKeys(value: unknown): string[] | undefined {
  return typeof value === "object" && value !== null ? Object.keys(value) : undefined;
}

export function parseJsonOrEmpty(value: string | undefined): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function mapStopReason(reason: string | null | undefined): string {
  if (reason === "tool_calls") {
    return "tool_use";
  }
  if (reason === "length") {
    return "max_tokens";
  }
  return "end_turn";
}
