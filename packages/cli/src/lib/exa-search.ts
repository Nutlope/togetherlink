type ExaSearchResult = {
  title?: string;
  url?: string;
  text?: string;
  publishedDate?: string;
};

type ExaSearchResponse = {
  autopromptString?: string;
  results?: ExaSearchResult[];
};

type NativeToolPromptOptions<Message, NativeTool> = {
  mergeLeadingSystemMessages?: (messages: Message[]) => Message[];
  toolName?: (tool: NativeTool) => string;
};

export type ExaSearchParams = {
  query: unknown;
  allowedDomains: string[];
  blockedDomains: string[];
  exaApiKey: string | undefined;
  queryKeys?: string[];
  debugLog?: (label: string, value: unknown) => void;
  missingApiKeyMessage?: string;
  includePublishedDate?: boolean;
  snippetLength?: number;
};

export function withNativeToolSystemPrompt<
  Message extends { role: string; content?: unknown },
  NativeTool,
>(
  messages: Message[],
  nativeTools: NativeTool[],
  options: NativeToolPromptOptions<Message, NativeTool> = {},
): Message[] {
  const toolName = options.toolName ?? ((tool: NativeTool) => String(tool));
  const prompt = [
    "Native server tools are available through function calls.",
    ...nativeTools.map(
      (tool) =>
        `- ${toolName(tool)}: call this for live web search. Always provide a concise non-empty query.`,
    ),
    "After tool results are returned, answer from the provided sources and include source URLs when relevant.",
  ].join("\n");
  const nextMessages = [{ role: "system", content: prompt } as Message, ...messages];
  return options.mergeLeadingSystemMessages
    ? options.mergeLeadingSystemMessages(nextMessages)
    : nextMessages;
}

export function nativeToolMaxUses(tool: { max_uses?: unknown }): number {
  const value = tool.max_uses;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 5;
}

export async function runExaSearch(params: ExaSearchParams): Promise<string> {
  const query = webSearchQuery(params.query, params.queryKeys);
  if (!query) {
    return "Web search error: missing query.";
  }

  const body = exaSearchBody({
    query,
    allowedDomains: params.allowedDomains,
    blockedDomains: params.blockedDomains,
  });
  const exaApiKey = params.exaApiKey?.trim();
  if (!exaApiKey) {
    return (
      params.missingApiKeyMessage ?? "Web search error: EXA_API_KEY is not set. Set it and retry."
    );
  }

  params.debugLog?.("exa search request", { query, hasApiKey: Boolean(exaApiKey), body });
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": exaApiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    params.debugLog?.("exa search error", { status: response.status, body: text.slice(0, 1000) });
    return `Web search error from Exa (${response.status}): ${text.slice(0, 1200)}`;
  }

  let json: ExaSearchResponse;
  try {
    json = JSON.parse(text) as ExaSearchResponse;
  } catch {
    return `Web search error: Exa returned non-JSON content: ${text.slice(0, 1200)}`;
  }

  const results = (json.results ?? []).slice(0, 5);
  if (results.length === 0) {
    return `Web search completed for "${query}" but returned no results.${json.autopromptString ? ` Autoprompt: ${json.autopromptString}` : ""}`;
  }

  const lines = [`Web search results for "${query}" via Exa:`];
  results.forEach((result, index) => {
    lines.push(
      [
        `${index + 1}. ${result.title ?? "Untitled"}`,
        `URL: ${result.url ?? ""}`,
        params.includePublishedDate && result.publishedDate
          ? `Published: ${result.publishedDate}`
          : "",
        `Snippet: ${trimSearchText(result.text ?? "", params.snippetLength)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  });
  if (json.autopromptString) {
    lines.push(`Autoprompt: ${json.autopromptString}`);
  }
  return lines.join("\n\n");
}

export function exaSearchBody(params: {
  query: string;
  allowedDomains: string[];
  blockedDomains: string[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query: params.query,
    numResults: 5,
    type: "auto",
    contents: { text: true },
  };
  if (params.allowedDomains.length > 0) {
    body.includeDomains = params.allowedDomains;
  }
  if (params.blockedDomains.length > 0) {
    body.excludeDomains = params.blockedDomains;
  }
  return body;
}

export function webSearchQuery(
  input: unknown,
  keys = ["query", "q", "search_query", "input"],
): string {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input !== "object" || input === null) {
    return "";
  }
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function stringArray(value: unknown, options: { requireTrimmed?: boolean } = {}): string[] {
  const requireTrimmed = options.requireTrimmed ?? true;
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && (requireTrimmed ? item.trim().length > 0 : item.length > 0),
      )
    : [];
}

export function trimSearchText(value: string, maxLength = 700): string {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}
