import { type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { TOGETHER_BASE_URL } from "../together-core.js";
import { type ModelDefinition } from "@togetherlink/models";
import { CODEX_SUPPORTED_MODELS } from "./defaults.js";
import type { CostTracker } from "../claude/cost.js";
import { readJsonBody, requestPath, writeJson } from "../claude/proxy.js";

type ResponsesContentPart = {
  type?: string;
  text?: string;
};

type ResponsesInputItem = {
  type?: string;
  role?: string;
  content?: string | ResponsesContentPart[];
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: unknown;
};

type ResponsesTool = {
  type?: string;
  name?: string;
  description?: string;
  parameters?: unknown;
  strict?: boolean;
};

type ResponsesRequest = {
  model?: string;
  instructions?: string;
  input?: string | ResponsesInputItem[];
  tools?: ResponsesTool[];
  tool_choice?: unknown;
  temperature?: number;
  max_output_tokens?: number;
  stream?: boolean;
  reasoning?: { effort?: string | null } | null;
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

type ChatResponse = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
  };
};

type ChatStreamChunk = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: ChatResponse["usage"];
};

type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type CodexProxyOptions = {
  apiKey: string;
  modelId: string;
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  authToken: string;
  debug?: boolean | undefined;
  costTracker?: CostTracker | undefined;
};

const CODEX_IDENTITY_PROMPT =
  "You are running inside Codex through togetherlink's local Responses-to-Together proxy. " +
  "The upstream model is a Together AI model, not an OpenAI model. " +
  "If asked what model you are, identify yourself as the selected Together AI backend routed by togetherlink.";

export async function handleCodexProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: CodexProxyOptions,
): Promise<void> {
  const path = requestPath(req);
  debugLog(options, "http request", { method: req.method, url: req.url, path });

  if (req.method === "HEAD" && path === "/") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/v1/models") {
    writeJson(res, 200, { models: CODEX_SUPPORTED_MODELS.map(toCodexModelCatalogEntry) });
    return;
  }

  if (req.method !== "POST" || path !== "/v1/responses") {
    writeOpenAIError(res, 404, "not_found_error", `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim());
    return;
  }

  const body = (await readJsonBody(req)) as ResponsesRequest;
  options.costTracker?.beginRequest();
  debugLog(options, "responses request", {
    model: body.model,
    stream: body.stream,
    inputItems: Array.isArray(body.input) ? body.input.length : typeof body.input,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount: (body.tools ?? []).filter((tool) => tool.type !== "function").length,
  });

  if (body.stream) {
    await streamResponseFromTogether(res, body, options);
    return;
  }

  const chatResponse = await callTogether(body, options, false);
  recordUsage(chatResponse.usage, options);
  writeJson(res, 200, toResponsesResponse(chatResponse, body, options));
}

function toCodexModelCatalogEntry(model: { id: string; definition: ModelDefinition }): Record<string, unknown> {
  const reasoningLevels = model.definition.reasoning
    ? [
        { effort: "low", description: "Fast responses with lighter reasoning" },
        { effort: "medium", description: "Balances speed and reasoning depth" },
        { effort: "high", description: "Greater reasoning depth for complex tasks" },
      ]
    : [];
  return {
    slug: model.id,
    display_name: model.definition.name,
    description: `Together AI model via togetherlink (${model.definition.id})`,
    default_reasoning_level: model.definition.reasoning ? "medium" : "none",
    supported_reasoning_levels: reasoningLevels,
    shell_type: "shell_command",
    visibility: "list",
    supported_in_api: true,
    priority: 50,
    upgrade: null,
    base_instructions: "",
    supports_reasoning_summaries: false,
    default_reasoning_summary: "none",
    support_verbosity: false,
    default_verbosity: "low",
    apply_patch_tool_type: "freeform",
    web_search_tool_type: "text_and_image",
    truncation_policy: { mode: "tokens", limit: model.definition.limit.context },
    supports_parallel_tool_calls: model.definition.tool_call,
    supports_image_detail_original: model.definition.attachment,
    context_window: model.definition.limit.context,
    max_context_window: model.definition.limit.context,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    input_modalities: model.definition.modalities.input,
    supports_search_tool: false,
    use_responses_lite: false,
  };
}

async function callTogether(
  body: ResponsesRequest,
  options: CodexProxyOptions,
  stream: boolean,
): Promise<ChatResponse> {
  const response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toChatPayload(body, options, stream)),
  });
  if (!response.ok) {
    await writeTogetherErrorAsThrow(response);
  }
  return (await response.json()) as ChatResponse;
}

function toChatPayload(body: ResponsesRequest, options: CodexProxyOptions, stream: boolean): Record<string, unknown> {
  const messages = toChatMessages(body, options);
  const tools = (body.tools ?? []).flatMap((tool) => {
    if (tool.type !== "function" || !tool.name) {
      return [];
    }
    return [
      {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description ?? "",
          parameters: tool.parameters ?? { type: "object", properties: {} },
        },
      },
    ];
  });
  return {
    model: options.targetModelId,
    messages,
    max_tokens: body.max_output_tokens,
    temperature: body.temperature,
    ...(tools.length > 0 ? { tools } : {}),
    tool_choice: toChatToolChoice(body.tool_choice),
    ...(reasoningEffort(body) ? { reasoning_effort: reasoningEffort(body) } : {}),
    chat_template_kwargs: { clear_thinking: false },
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

function toChatMessages(body: ResponsesRequest, options: CodexProxyOptions): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${CODEX_IDENTITY_PROMPT}\nSelected Together backend: ${options.modelName} (${options.targetModelId}).`,
    },
  ];
  if (body.instructions) {
    messages.push({ role: "system", content: body.instructions });
  }
  if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input });
    return messages;
  }
  for (const item of body.input ?? []) {
    if (item.type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: item.call_id ?? `call_${randomUUID().replaceAll("-", "")}`,
            type: "function",
            function: { name: item.name ?? "tool", arguments: item.arguments ?? "{}" },
          },
        ],
      });
      continue;
    }
    if (item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id ?? "",
        content: stringifyUnknown(item.output),
      });
      continue;
    }
    if (item.type === "message" || item.role) {
      const role = toChatRole(item.role);
      messages.push({ role, content: stringifyResponsesContent(item.content) });
    }
  }
  return messages;
}

function toChatRole(role: string | undefined): ChatMessage["role"] {
  if (role === "assistant") {
    return "assistant";
  }
  if (role === "developer" || role === "system") {
    return "system";
  }
  return "user";
}

function stringifyResponsesContent(content: ResponsesInputItem["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  return (content ?? [])
    .map((part) => {
      if (part.type === "input_text" || part.type === "output_text" || part.type === "text") {
        return part.text ?? "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function toChatToolChoice(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object") {
    return undefined;
  }
  const choice = toolChoice as { type?: unknown; name?: unknown };
  if (choice.type === "auto") {
    return "auto";
  }
  if (choice.type === "required") {
    return "required";
  }
  if (choice.type === "function" && typeof choice.name === "string") {
    return { type: "function", function: { name: choice.name } };
  }
  return undefined;
}

function reasoningEffort(body: ResponsesRequest): string | undefined {
  const effort = body.reasoning?.effort;
  if (effort === "low" || effort === "medium" || effort === "high") {
    return effort;
  }
  if (effort === "xhigh") {
    return "max";
  }
  return undefined;
}

function toResponsesResponse(chatResponse: ChatResponse, body: ResponsesRequest, options: CodexProxyOptions): Record<string, unknown> {
  const responseId = chatResponse.id ?? `resp_${randomUUID().replaceAll("-", "")}`;
  return {
    id: responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    model: body.model ?? options.modelId,
    output: toResponsesOutput(chatResponse),
    usage: toResponsesUsage(chatResponse.usage),
  };
}

function toResponsesOutput(chatResponse: ChatResponse): Record<string, unknown>[] {
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
    output.push(functionCallOutputItem({
      id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
      name: toolCall.function?.name ?? "tool",
      arguments: toolCall.function?.arguments ?? "{}",
    }));
  }
  return output;
}

async function streamResponseFromTogether(
  res: ServerResponse,
  body: ResponsesRequest,
  options: CodexProxyOptions,
): Promise<void> {
  const responseId = `resp_${randomUUID().replaceAll("-", "")}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  writeResponsesSse(res, "response.created", {
    type: "response.created",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "in_progress",
      model: body.model ?? options.modelId,
      output: [],
    },
  });

  const upstream = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toChatPayload(body, options, true)),
  });
  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text().catch(() => "");
    writeResponsesSse(res, "response.failed", {
      type: "response.failed",
      response: { id: responseId, status: "failed" },
      error: { message: `Together API returned ${upstream.status}: ${errorText.slice(0, 1000)}` },
    });
    res.end();
    return;
  }

  let textItemOpened = false;
  let text = "";
  const toolCalls = new Map<number, PendingToolCall>();
  let usage: ChatResponse["usage"] | undefined;

  for await (const chunk of parseSseChunks(upstream.body)) {
    if (chunk === "[DONE]") {
      break;
    }
    let parsed: ChatStreamChunk;
    try {
      parsed = JSON.parse(chunk) as ChatStreamChunk;
    } catch {
      continue;
    }
    if (parsed.usage) {
      usage = parsed.usage;
    }
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) {
      continue;
    }
    if (delta.content) {
      if (!textItemOpened) {
        textItemOpened = true;
        writeOutputTextStart(res);
      }
      text += delta.content;
      writeResponsesSse(res, "response.output_text.delta", {
        type: "response.output_text.delta",
        item_id: "msg_0",
        output_index: 0,
        content_index: 0,
        delta: delta.content,
      });
    }
    for (const toolCall of delta.tool_calls ?? []) {
      const index = toolCall.index ?? 0;
      const current = toolCalls.get(index) ?? {
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        name: "",
        arguments: "",
      };
      if (toolCall.id) {
        current.id = toolCall.id;
      }
      if (toolCall.function?.name) {
        current.name += toolCall.function.name;
      }
      if (toolCall.function?.arguments) {
        current.arguments += toolCall.function.arguments;
      }
      toolCalls.set(index, current);
    }
  }

  if (textItemOpened) {
    writeResponsesSse(res, "response.output_text.done", {
      type: "response.output_text.done",
      item_id: "msg_0",
      output_index: 0,
      content_index: 0,
      text,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: 0,
      item: messageOutputItem(text, "msg_0"),
    });
  }

  let outputIndex = textItemOpened ? 1 : 0;
  for (const toolCall of [...toolCalls.values()]) {
    const item = functionCallOutputItem(toolCall);
    writeResponsesSse(res, "response.output_item.added", {
      type: "response.output_item.added",
      output_index: outputIndex,
      item,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputIndex,
      item,
    });
    outputIndex += 1;
  }

  if (usage) {
    recordUsage(usage, options);
  }
  writeResponsesSse(res, "response.completed", {
    type: "response.completed",
    response: {
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: body.model ?? options.modelId,
      output: [
        ...(textItemOpened ? [messageOutputItem(text, "msg_0")] : []),
        ...[...toolCalls.values()].map((toolCall) => functionCallOutputItem(toolCall)),
      ],
      usage: toResponsesUsage(usage),
    },
  });
  res.end();
}

function writeOutputTextStart(res: ServerResponse): void {
  const item = { id: "msg_0", type: "message", role: "assistant", status: "in_progress", content: [] };
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: 0,
    item,
  });
  writeResponsesSse(res, "response.content_part.added", {
    type: "response.content_part.added",
    item_id: "msg_0",
    output_index: 0,
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  });
}

function messageOutputItem(text: string, id = `msg_${randomUUID().replaceAll("-", "")}`): Record<string, unknown> {
  return {
    id,
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  };
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

async function* parseSseChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const rawChunk of body) {
    buffer += decoder.decode(rawChunk, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");
      if (data) {
        yield data;
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function writeResponsesSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toResponsesUsage(usage: ChatResponse["usage"]): Record<string, unknown> {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
  };
}

function recordUsage(usage: ChatResponse["usage"], options: CodexProxyOptions): void {
  if (!usage) {
    return;
  }
  options.costTracker?.addUsage(
    usage.prompt_tokens ?? 0,
    usage.cached_tokens ?? 0,
    usage.completion_tokens ?? 0,
    options.modelDefinition,
  );
}

async function writeTogetherErrorAsThrow(response: Response): Promise<never> {
  const text = await response.text();
  throw new Error(`Together API returned ${response.status}: ${text.slice(0, 1000)}`);
}

function writeOpenAIError(res: ServerResponse, status: number, type: string, message: string): void {
  writeJson(res, status, { error: { type, message } });
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function debugLog(options: CodexProxyOptions, label: string, payload: unknown): void {
  if (!options.debug) {
    return;
  }
  process.stderr.write(`[togetherlink codex proxy] ${label}: ${JSON.stringify(payload)}\n`);
}
