import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { TOGETHER_BASE_URL } from "./together-core.js";
import { CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_TOGETHER_MODEL, CLAUDE_LOCAL_PROXY_HOST } from "./claude-defaults.js";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: unknown };

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
  tools?: Array<{ name: string; description?: string; input_schema?: unknown }>;
  tool_choice?: unknown;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
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
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export type ClaudeProxyOptions = {
  apiKey: string;
  modelId: string;
  debug?: boolean;
};

export type ClaudeProxyHandle = {
  url: string;
  close: () => Promise<void>;
};

export async function startClaudeProxy(options: ClaudeProxyOptions): Promise<ClaudeProxyHandle> {
  const server = http.createServer((req, res) => {
    handleProxyRequest(req, res, options).catch((err: unknown) => {
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
  debugLog(options, "anthropic request", {
    model: body.model,
    stream: body.stream,
    messageCount: body.messages?.length ?? 0,
    toolCount: body.tools?.length ?? 0,
  });
  const openAiResponse = await callTogetherChatCompletions(body, options);
  const anthropicMessage = toAnthropicMessage(openAiResponse, body.model ?? options.modelId);

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
  const payload = {
    model: targetModel,
    messages: toOpenAIMessages(body),
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    tools: body.tools?.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.input_schema ?? { type: "object", properties: {} },
      },
    })),
    stream: false,
  };
  debugLog(options, "together request", {
    model: payload.model,
    messageCount: payload.messages.length,
    toolCount: payload.tools?.length ?? 0,
    maxTokens: payload.max_tokens,
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
  debugLog(options, "together response", {
    id: json.id,
    choices: json.choices?.length ?? 0,
    finishReason: json.choices?.[0]?.finish_reason,
  });
  return json;
}

function resolveTargetModel(_requestedModel: string | undefined, _options: ClaudeProxyOptions): string {
  const targetModel = CLAUDE_DEFAULT_TOGETHER_MODEL;
  return targetModel;
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
    const toolCalls: OpenAIMessage["tool_calls"] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
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

    messages.push({
      role: message.role,
      content: textParts.join("\n") || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  }

  return messages;
}

function toAnthropicMessage(response: OpenAIChatResponse, model: string): Record<string, unknown> {
  const choice = response.choices?.[0];
  const message = choice?.message ?? {};
  const content: Array<Record<string, unknown>> = [];
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
    writeSse(res, "content_block_start", { type: "content_block_start", index, content_block: block });
    if (isTextBlock(block)) {
      writeSse(res, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: { type: "text_delta", text: block.text },
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
