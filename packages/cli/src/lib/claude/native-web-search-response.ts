import { randomUUID } from "node:crypto";
import type { ExaSearchOutcome } from "../exa-search.js";
import type { ClaudeNativeWebSearchRecord } from "./wire-types.js";

export function createClaudeNativeWebSearchRecord({
  input,
  outcome,
  fallbackErrorCode = "unavailable",
}: {
  input: unknown;
  outcome?: ExaSearchOutcome | undefined;
  fallbackErrorCode?: string | undefined;
}): ClaudeNativeWebSearchRecord {
  return {
    id: `srvtoolu_${randomUUID().replaceAll("-", "")}`,
    name: "web_search",
    input,
    result: searchResultContent(outcome, fallbackErrorCode),
  };
}

export function nativeWebSearchBlocks(
  record: ClaudeNativeWebSearchRecord,
): Array<Record<string, unknown>> {
  return [
    {
      type: "server_tool_use",
      id: record.id,
      name: record.name,
      input: record.input,
    },
    {
      type: "web_search_tool_result",
      tool_use_id: record.id,
      content: record.result,
    },
  ];
}

function searchResultContent(
  outcome: ExaSearchOutcome | undefined,
  fallbackErrorCode: string,
): ClaudeNativeWebSearchRecord["result"] {
  if (!outcome) {
    return { type: "web_search_tool_result_error", error_code: fallbackErrorCode };
  }
  if (outcome.errorCode) {
    return { type: "web_search_tool_result_error", error_code: outcome.errorCode };
  }
  return outcome.results.flatMap((result) => {
    const url = result.url?.trim();
    if (!url) {
      return [];
    }
    return [
      {
        type: "web_search_result" as const,
        title: result.title?.trim() || "Untitled",
        url,
      },
    ];
  });
}
