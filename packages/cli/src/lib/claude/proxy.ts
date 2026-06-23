import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { TOGETHER_BASE_URL } from "../together-core.js";
import { CLAUDE_DEFAULT_TOGETHER_MODEL, CLAUDE_LOCAL_PROXY_HOST } from "./defaults.js";
import { CostTracker } from "./cost.js";
import { describeImage, imageBlockKey, isImageBlock, isUrlImageBlock, type ImageBlock, type UrlBlock } from "./vision.js";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: unknown }
  | { type: "image"; source: { type: string; media_type?: string; data?: string; url?: string } }
  | { type: "url"; url: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicMessagesRequest = {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  system?: string | AnthropicContentBlock[];
  messages?: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: unknown;
};

type AnthropicTool = {
  name?: string;
  description?: string;
  input_schema?: unknown;
  type?: string;
  [key: string]: unknown;
};

type NativeServerTool = {
  kind: "web_search";
  name: string;
  definition: AnthropicTool;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  reasoning?: string;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

type OpenAIChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
  };
};

type ExaSearchResult = {
  title?: string;
  url?: string;
  text?: string;
  author?: string;
  publishedDate?: string;
  score?: number;
};

type ExaSearchResponse = {
  results?: ExaSearchResult[];
  autopromptString?: string;
};

export type ClaudeProxyOptions = {
  apiKey: string;
  modelId: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
};

export type ClaudeProxyHandle = {
  url: string;
  close: () => Promise<void>;
  costSummary: () => string;
};

export async function startClaudeProxy(options: ClaudeProxyOptions): Promise<ClaudeProxyHandle> {
  // Create a shared tracker if the caller didn't supply one, so the handle can
  // always report a session total at shutdown.
  const costTracker = options.costTracker ?? new CostTracker();
  const serverOptions: ClaudeProxyOptions = { ...options, costTracker };

  const server = http.createServer((req, res) => {
    handleProxyRequest(req, res, serverOptions).catch((err: unknown) => {
      writeAnthropicError(res, 500, err instanceof Error ? err.message : String(err));
    });
  });

  server.listen(0, CLAUDE_LOCAL_PROXY_HOST);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind local Claude proxy.");
  }

  return {
    url: `http://${CLAUDE_LOCAL_PROXY_HOST}:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    },
    costSummary: () => costTracker.summarize(),
  };
}

async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: ClaudeProxyOptions,
): Promise<void> {
  const path = requestPath(req);
  debugLog(options, "http request", { method: req.method, url: req.url, path });

  if (req.method === "HEAD" && path === "/") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && path === "/v1/models") {
    writeJson(res, 200, {
      data: [
        {
          id: options.modelId,
          type: "model",
          object: "model",
          display_name: "Together GLM 5.2",
          created_at: "2026-06-16T00:00:00Z",
        },
        {
          id: `${options.modelId}[1m]`,
          type: "model",
          object: "model",
          display_name: "Together GLM 5.2 (1M)",
          created_at: "2026-06-16T00:00:00Z",
        },
      ],
    });
    return;
  }

  if (req.method !== "POST" || path !== "/v1/messages") {
    writeAnthropicError(res, 404, `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim());
    return;
  }

  const body = (await readJsonBody(req)) as AnthropicMessagesRequest;
  options.costTracker?.beginRequest();
  debugLog(options, "anthropic request", {
    model: body.model,
    stream: body.stream,
    messageCount: body.messages?.length ?? 0,
    toolCount: body.tools?.length ?? 0,
    tools: summarizeAnthropicTools(body.tools),
  });
  const imageBlocks = extractImageBlocks(body);
  if (imageBlocks.length > 0) {
    debugLog(options, "image blocks detected", imageBlocks);
  }
  // GLM-5.2 can't see images: describe each image/url block with a vision model
  // and replace it with a text block, so GLM reasons over the description.
  await resolveImageBlocks(body, options);
  const openAiResponse = await callTogetherChatCompletions(body, options);
  const anthropicMessage = toAnthropicMessage(openAiResponse, body.model ?? options.modelId);

  const delta = options.costTracker?.requestDelta;
  const totals = options.costTracker?.totals;
  if (options.debug && delta && totals) {
    debugLog(options, "request cost", {
      requestCostUsd: Number(delta.costUsd.toFixed(6)),
      requestInputTokens: delta.promptTokens,
      requestCachedTokens: delta.cachedTokens,
      requestOutputTokens: delta.completionTokens,
      sessionTotalCostUsd: Number(totals.costUsd.toFixed(6)),
    });
  }

  if (body.stream) {
    writeAnthropicStream(res, anthropicMessage);
  } else {
    writeJson(res, 200, anthropicMessage);
  }
}

async function callTogetherChatCompletions(
  body: AnthropicMessagesRequest,
  options: ClaudeProxyOptions,
): Promise<OpenAIChatResponse> {
  const targetModel = resolveTargetModel(body.model, options);
  const nativeTools = nativeServerTools(body.tools);
  const nativeToolNames = new Set(nativeTools.map((tool) => tool.name));
  const nativeToolUses = new Map<string, number>();
  const messages = toOpenAIMessages(body);
  const tools = body.tools?.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: toOpenAIToolParameters(tool),
    },
  }));

  for (let turn = 0; turn < 5; turn += 1) {
    const payload = {
      model: targetModel,
      messages:
        turn === 0 && nativeTools.length > 0 ? withNativeToolSystemPrompt(messages, nativeTools) : messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      tools,
      reasoning_effort: "high",
      chat_template_kwargs: { clear_thinking: false },
      stream: false,
    };
    debugLog(options, "together request", {
      model: payload.model,
      messageCount: payload.messages.length,
      toolCount: payload.tools?.length ?? 0,
      maxTokens: payload.max_tokens,
      nativeToolCount: nativeTools.length,
      turn,
    });
    const response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      debugLog(options, "together error", { status: response.status, body: text.slice(0, 1000) });
      throw new Error(`Together API returned ${response.status}: ${text.slice(0, 500)}`);
    }
    const json = (await response.json()) as OpenAIChatResponse;
    const usage = json.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const cachedTokens = usage?.cached_tokens ?? 0;
    const incrementalCost = options.costTracker?.addUsage(promptTokens, cachedTokens, completionTokens) ?? 0;
    debugLog(options, "together response", {
      id: json.id,
      choices: json.choices?.length ?? 0,
      finishReason: json.choices?.[0]?.finish_reason,
      usage: { promptTokens, completionTokens, cachedTokens },
      incrementalCostUsd: Number(incrementalCost.toFixed(6)),
      toolCalls: json.choices?.[0]?.message?.tool_calls?.map((toolCall) => ({
        name: toolCall.function?.name,
        argumentsPreview: toolCall.function?.arguments?.slice(0, 300),
      })),
    });

    const toolCalls = json.choices?.[0]?.message?.tool_calls ?? [];
    const nativeToolCalls = toolCalls.filter((toolCall) => nativeToolNames.has(toolCall.function?.name ?? ""));
    if (nativeToolCalls.length === 0) {
      return json;
    }

    const reasoning = json.choices?.[0]?.message?.reasoning ?? json.choices?.[0]?.message?.reasoning_content;
    messages.push({
      role: "assistant",
      content: json.choices?.[0]?.message?.content ?? null,
      ...(reasoning ? { reasoning } : {}),
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}",
        },
      })),
    });

    for (const toolCall of nativeToolCalls) {
      const id = toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`;
      const name = toolCall.function?.name ?? "web_search";
      const nativeTool = nativeTools.find((tool) => tool.name === name);
      const input = parseJsonOrEmpty(toolCall.function?.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const maxUses = nativeTool ? nativeToolMaxUses(nativeTool.definition) : 0;
      let result: string;
      if (priorUses >= maxUses) {
        result = `Web search error: max_uses_exceeded for ${name}. Do not call this tool again; answer from the results already provided or say search is unavailable.`;
      } else if (nativeTool?.kind === "web_search") {
        nativeToolUses.set(name, priorUses + 1);
        result = await runExaSearch(input, nativeTool.definition, options);
      } else {
        result = "Unsupported native server tool.";
      }
      messages.push({ role: "tool", tool_call_id: id, content: result });
    }
  }

  return {
    id: `msg_${randomUUID().replaceAll("-", "")}`,
    choices: [
      {
        finish_reason: "stop",
        message: {
          content:
            "I could not complete the native web search because the model kept requesting additional search tool calls.",
        },
      },
    ],
  };
}

function resolveTargetModel(_requestedModel: string | undefined, _options: ClaudeProxyOptions): string {
  const targetModel = CLAUDE_DEFAULT_TOGETHER_MODEL;
  return targetModel;
}

function toOpenAIToolParameters(tool: AnthropicTool): unknown {
  if (tool.input_schema) {
    return tool.input_schema;
  }
  if (isWebSearchTool(tool)) {
    return {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    };
  }
  return { type: "object", properties: {} };
}

function nativeServerTools(tools: AnthropicTool[] | undefined): NativeServerTool[] {
  return (tools ?? []).flatMap((tool) => {
    if (!isWebSearchTool(tool)) {
      return [];
    }
    return [{ kind: "web_search", name: tool.name ?? "web_search", definition: tool }];
  });
}

function isWebSearchTool(tool: AnthropicTool): boolean {
  return tool.type?.startsWith("web_search_") === true || tool.name === "web_search";
}

function nativeToolMaxUses(tool: AnthropicTool): number {
  return typeof tool.max_uses === "number" && Number.isFinite(tool.max_uses)
    ? Math.max(0, Math.floor(tool.max_uses))
    : 5;
}

function withNativeToolSystemPrompt(messages: OpenAIMessage[], nativeTools: NativeServerTool[]): OpenAIMessage[] {
  const prompt = [
    "Native server tools are available through function calls.",
    ...nativeTools.map((tool) => `- ${tool.name}: call this for live web search. Always provide a concise non-empty query.`),
    "After tool results are returned, answer from the provided sources and include source URLs when relevant.",
  ].join("\n");
  return [{ role: "system", content: prompt }, ...messages];
}

async function runExaSearch(input: unknown, tool: AnthropicTool, options: ClaudeProxyOptions): Promise<string> {
  const query = webSearchQuery(input);
  if (!query) {
    return "Web search error: missing query.";
  }

  const allowedDomains = stringArray(tool.allowed_domains);
  const blockedDomains = stringArray(tool.blocked_domains);
  const includeDomains = allowedDomains.length > 0 ? allowedDomains : undefined;
  const excludeDomains = blockedDomains.length > 0 ? blockedDomains : undefined;

  const body: Record<string, unknown> = {
    query,
    numResults: 5,
    type: "auto",
    contents: { text: true },
  };
  if (includeDomains) {
    body.includeDomains = includeDomains;
  }
  if (excludeDomains) {
    body.excludeDomains = excludeDomains;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const exaApiKey = process.env.EXA_API_KEY?.trim();
  if (!exaApiKey) {
    return "Web search error: EXA_API_KEY is not set. Set it in the repo .env (EXA_API_KEY=...) and retry.";
  }
  headers["x-api-key"] = exaApiKey;

  debugLog(options, "exa search request", { query, hasApiKey: Boolean(exaApiKey), body });
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    debugLog(options, "exa search error", { status: response.status, body: text.slice(0, 1000) });
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
        `Snippet: ${trimSearchText(result.text ?? "")}`,
      ].join("\n"),
    );
  });
  if (json.autopromptString) {
    lines.push(`Autoprompt: ${json.autopromptString}`);
  }
  return lines.join("\n\n");
}

function webSearchQuery(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }
  if (typeof input !== "object" || input === null) {
    return "";
  }
  const value = (input as { query?: unknown; q?: unknown }).query ?? (input as { query?: unknown; q?: unknown }).q;
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function trimSearchText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

function toOpenAIMessages(body: AnthropicMessagesRequest): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];
  const system = stringifyAnthropicContent(body.system);
  if (system) {
    messages.push({ role: "system", content: system });
  }

  for (const message of body.messages ?? []) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }

    const textParts: string[] = [];
    const reasoningParts: string[] = [];
    const toolCalls: OpenAIMessage["tool_calls"] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "thinking") {
        reasoningParts.push(block.thinking);
      } else if (block.type === "redacted_thinking") {
        reasoningParts.push(block.data);
      } else if (block.type === "tool_result") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: stringifyUnknown(block.content),
        });
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }

    const content = textParts.join("\n");
    if (content || reasoningParts.length > 0 || toolCalls.length > 0) {
      messages.push({
        role: message.role,
        content: content || null,
        ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join("\n") } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    }
  }

  return messages;
}

function toAnthropicMessage(response: OpenAIChatResponse, model: string): Record<string, unknown> {
  const choice = response.choices?.[0];
  const message = choice?.message ?? {};
  const content: Array<Record<string, unknown>> = [];
  const reasoning = message.reasoning ?? message.reasoning_content;
  if (reasoning) {
    content.push({
      type: "thinking",
      thinking: reasoning,
      signature: `togetherlink:${Buffer.from(reasoning).toString("base64url")}`,
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

function writeAnthropicStream(res: ServerResponse, message: Record<string, unknown>): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  writeSse(res, "message_start", { type: "message_start", message: { ...message, content: [] } });
  const content = Array.isArray(message.content) ? message.content : [];
  content.forEach((block, index) => {
    const contentBlock = isToolUseBlock(block) ? { ...block, input: {} } : block;
    writeSse(res, "content_block_start", { type: "content_block_start", index, content_block: contentBlock });
    if (isTextBlock(block)) {
      writeSse(res, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "text_delta", text: block.text },
      });
    } else if (isThinkingBlock(block)) {
      writeSse(res, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "thinking_delta", thinking: block.thinking },
      });
      writeSse(res, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "signature_delta", signature: block.signature ?? "" },
      });
    } else if (isToolUseBlock(block)) {
      writeSse(res, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input ?? {}) },
      });
    }
    writeSse(res, "content_block_stop", { type: "content_block_stop", index });
  });
  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: message.stop_reason, stop_sequence: null },
    usage: message.usage,
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
}

function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function writeAnthropicError(res: ServerResponse, status: number, message: string): void {
  writeJson(res, status, {
    type: "error",
    error: { type: status === 404 ? "not_found_error" : "api_error", message },
  });
}

function debugLog(options: ClaudeProxyOptions, label: string, value: unknown): void {
  if (!options.debug) {
    return;
  }
  process.stderr.write(`[togetherlink proxy] ${label}: ${JSON.stringify(value)}\n`);
}

function requestPath(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function stringifyAnthropicContent(content: AnthropicMessagesRequest["system"]): string {
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

// Cross-request cache: the same image recurs in conversation history across
// turns, so keep its description to avoid re-billing the vision model each time.
const imageDescriptionCache = new Map<string, string>();

/**
 * Find every image/url block in the request, describe it with the vision model,
 * and replace it in place with a `text` block holding the description. GLM-5.2
 * is text-only, so this is what lets Claude Code's images reach the model.
 */
async function resolveImageBlocks(body: AnthropicMessagesRequest, options: ClaudeProxyOptions): Promise<void> {
  const descriptions = new Map<string, string>();

  const resolve = async (block: AnthropicContentBlock): Promise<AnthropicContentBlock> => {
    if (!isImageBlock(block) && !isUrlImageBlock(block)) {
      return block;
    }
    const key = imageBlockKey(block);
    let cached = descriptions.get(key) ?? imageDescriptionCache.get(key);
    if (cached === undefined) {
      debugLog(options, "vision describe start", { key });
      const result = await describeImage(block as ImageBlock | UrlBlock, {
        apiKey: options.apiKey,
        debug: options.debug,
      });
      debugLog(options, "vision describe done", {
        key,
        model: result.model,
        length: result.description.length,
        preview: result.description.slice(0, 200),
      });
      if (result.usage) {
        options.costTracker?.addVisionUsage(result.model, result.usage.promptTokens, result.usage.completionTokens);
      }
      cached = `${result.description}\n[described by ${result.model}]`;
      imageDescriptionCache.set(key, cached);
    }
    descriptions.set(key, cached);
    return { type: "text", text: `[Image description]\n${cached}` };
  };

  // Replace image blocks inside the system content array.
  if (Array.isArray(body.system)) {
    body.system = await Promise.all(body.system.map((block) => resolve(block)));
  }

  // Replace image blocks inside each message's content array.
  for (const message of body.messages ?? []) {
    if (Array.isArray(message.content)) {
      message.content = await Promise.all(message.content.map((block) => resolve(block)));
    }
  }
}

/**
 * Walks the request for image-like content blocks and returns a debug-friendly
 * summary (base64/url data truncated). Used to learn the exact shape Claude
 * Code sends when a user attaches a photo or screenshot, so the proxy can
 * intercept and route images to a vision-capable Together model.
 */
function extractImageBlocks(body: AnthropicMessagesRequest): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  const knownTypes = new Set(["text", "thinking", "redacted_thinking", "tool_use", "tool_result"]);

  const inspectBlock = (block: unknown, location: string): void => {
    if (typeof block !== "object" || block === null) {
      return;
    }
    const record = block as Record<string, unknown>;
    const type = record.type;
    const isImageLike =
      type === "image" || type === "url" || type === "document" || (typeof type === "string" && !knownTypes.has(type));
    if (!isImageLike) {
      return;
    }
    const summary: Record<string, unknown> = { location, type, rawKeys: Object.keys(record) };
    const source = record.source as Record<string, unknown> | undefined;
    if (source) {
      summary.sourceType = source.type;
      summary.mediaType = source.media_type;
      const data = source.data;
      summary.dataPreview = typeof data === "string" ? `${data.slice(0, 32)}… (${data.length} chars)` : typeof data;
    }
    const url = record.url;
    if (typeof url === "string") {
      summary.urlPreview = url.length > 64 ? `${url.slice(0, 64)}…` : url;
    }
    found.push(summary);
  };

  const inspectContent = (content: unknown, location: string): void => {
    if (!Array.isArray(content)) {
      return;
    }
    for (const block of content) {
      inspectBlock(block, location);
      // tool_result content can itself be an array of blocks (e.g. an image
      // returned by a tool), so recurse one level.
      const inner = (block as Record<string, unknown> | null)?.content;
      if (Array.isArray(inner)) {
        for (const innerBlock of inner) {
          inspectBlock(innerBlock, `${location}/tool_result`);
        }
      }
    }
  };

  inspectContent(body.system, "system");
  for (const message of body.messages ?? []) {
    inspectContent(message.content, `messages[${message.role}]`);
  }
  return found;
}

function summarizeAnthropicTools(tools: AnthropicTool[] | undefined): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.slice(0, 5).map((tool) => ({
    name: tool.name,
    type: tool.type,
    inputSchemaKeys: objectKeys(tool.input_schema),
    rawKeys: Object.keys(tool),
  }));
}

function objectKeys(value: unknown): string[] | undefined {
  return typeof value === "object" && value !== null ? Object.keys(value) : undefined;
}

function parseJsonOrEmpty(value: string | undefined): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function mapStopReason(reason: string | null | undefined): string {
  if (reason === "length") {
    return "max_tokens";
  }
  return "end_turn";
}

function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  return typeof block === "object" && block !== null && "type" in block && block.type === "text" && "text" in block;
}

function isThinkingBlock(block: unknown): block is { type: "thinking"; thinking: string; signature?: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "thinking" &&
    "thinking" in block
  );
}

function isToolUseBlock(block: unknown): block is { type: "tool_use"; input?: unknown } {
  return typeof block === "object" && block !== null && "type" in block && block.type === "tool_use";
}
