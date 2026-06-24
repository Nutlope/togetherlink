import { type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { TOGETHER_BASE_URL } from "../together-core.js";
import { type ModelDefinition } from "@togetherlink/models";
import { codexModelCatalog } from "./catalog.js";
import type { CostTracker } from "../claude/cost.js";
import { readJsonBody, requestPath, writeJson } from "../claude/proxy.js";
import { redactTraceError, type ProxyTraceEvent } from "../proxy-trace.js";

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
    reasoning_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
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

type TogetherChatResult =
  | { ok: true; response: Response; error?: undefined }
  | { ok: false; status: number; text: string; error?: undefined };

type StreamOutputState = {
  nextOutputIndex: number;
  reasoningItemId?: string;
  reasoningOutputIndex?: number;
  reasoningText: string;
  textItemId?: string;
  textOutputIndex?: number;
  text: string;
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
  recordTrace?: ((trace: ProxyTraceEvent) => void) | undefined;
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
    writeJson(res, 200, codexModelCatalog());
    return;
  }

  if (req.method !== "POST" || path !== "/v1/responses") {
    writeOpenAIError(res, 404, "not_found_error", `Unsupported route ${req.method ?? ""} ${req.url ?? ""}`.trim());
    return;
  }

  const body = (await readJsonBody(req)) as ResponsesRequest;
  const nativeToolCount = (body.tools ?? []).filter((tool) => tool.type !== "function").length;
  const traceBase = {
    id: randomUUID(),
    route: path,
    method: req.method ?? "POST",
    model: body.model ?? options.modelId,
    stream: Boolean(body.stream),
    requestBytes: Buffer.byteLength(JSON.stringify(body), "utf8"),
    requestPreview: summarizeResponsesRequestContent(body),
    messageCount: Array.isArray(body.input) ? body.input.length : typeof body.input === "string" ? 1 : 0,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount,
    startedAt: Date.now(),
  };
  recordProxyTrace(options, traceBase);
  const upstreamAbort = new AbortController();
  let traceFinalized = false;
  const finalizeTrace = (ok: boolean, status?: number, error?: string) => {
    if (traceFinalized) {
      return;
    }
    traceFinalized = true;
    recordProxyTrace(options, traceBase, ok, status, error);
  };
  const markClientDisconnected = () => {
    upstreamAbort.abort();
    finalizeTrace(false, 499, "Client disconnected before the proxy completed the request.");
  };
  req.once("aborted", markClientDisconnected);
  res.once("close", () => {
    if (!res.writableEnded) {
      markClientDisconnected();
    }
  });
  options.costTracker?.beginRequest();
  debugLog(options, "responses request", {
    model: body.model,
    stream: body.stream,
    inputItems: Array.isArray(body.input) ? body.input.length : typeof body.input,
    toolCount: body.tools?.length ?? 0,
    nativeToolCount,
    tools: summarizeResponsesTools(body.tools),
  });

  try {
    if (body.stream) {
      await streamResponseFromTogether(res, body, options, upstreamAbort.signal);
      finalizeTrace(true, res.statusCode);
      return;
    }

    const chatResponse = await callTogether(body, options, false, upstreamAbort.signal);
    recordUsage(chatResponse.usage, options);
    writeJson(res, 200, toResponsesResponse(chatResponse, body, options));
    finalizeTrace(true, res.statusCode);
  } catch (err) {
    finalizeTrace(false, res.statusCode >= 400 ? res.statusCode : 500, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

function recordProxyTrace(
  options: CodexProxyOptions,
  base: Omit<ProxyTraceEvent, "durationMs" | "completedAt" | "ok" | "status" | "error" | "usage">,
  ok?: boolean,
  status?: number,
  error?: string,
): void {
  const completedAt = ok === undefined ? undefined : Date.now();
  options.recordTrace?.({
    ...base,
    ...(completedAt !== undefined && ok !== undefined ? { completedAt, durationMs: completedAt - base.startedAt, ok } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(error ? { error: redactTraceError(error) } : {}),
    ...(ok !== undefined && options.costTracker ? { usage: options.costTracker.requestDelta } : {}),
  });
}

function summarizeResponsesRequestContent(body: ResponsesRequest): string {
  const parts: string[] = [];
  if (body.instructions?.trim()) {
    parts.push(`instructions: ${body.instructions}`);
  }
  if (typeof body.input === "string") {
    parts.push(`input: ${body.input}`);
  } else if (Array.isArray(body.input)) {
    for (const item of body.input) {
      const label = item.role ?? item.type ?? "item";
      const content = summarizeResponsesContent(item.content);
      if (content) {
        parts.push(`${label}: ${content}`);
      } else if (item.name) {
        parts.push(`${label}: [tool ${item.name}]`);
      }
    }
  }
  const toolNames = body.tools?.map((tool) => tool.name ?? tool.type).filter(Boolean);
  if (toolNames?.length) {
    parts.push(`tools: ${toolNames.join(", ")}`);
  }
  return redactTraceError(parts.join("\n")).slice(0, 2000);
}

function summarizeResponsesContent(content: string | ResponsesContentPart[] | undefined): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part.text === "string") {
        return part.text;
      }
      return part.type ? `[${part.type}]` : "";
    })
    .filter(Boolean)
    .join(" ");
}

async function callTogether(
  body: ResponsesRequest,
  options: CodexProxyOptions,
  stream: boolean,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const result = await fetchTogetherChat(toChatPayload(body, options, stream), options, signal);
  if (!result.ok) {
    throw new Error(`Together API returned ${result.status}: ${result.text.slice(0, 1000)}`);
  }
  return (await result.response.json()) as ChatResponse;
}

async function fetchTogetherChat(payload: Record<string, unknown>, options: CodexProxyOptions, signal?: AbortSignal): Promise<TogetherChatResult> {
  const first = await postTogetherChat(payload, options, signal);
  if (first.ok) {
    return { ok: true, response: first };
  }
  const text = await first.text();
  const retryMaxTokens = maxTokensForContextLengthRetry(text, options, payload.max_tokens);
  if (retryMaxTokens === undefined) {
    return { ok: false, status: first.status, text };
  }
  const retryPayload: Record<string, unknown> = { ...payload, max_tokens: retryMaxTokens };
  debugLog(options, "retrying together request with reduced max_tokens", {
    model: retryPayload.model,
    maxTokens: retryMaxTokens,
    originalError: text.slice(0, 1000),
  });
  const retry = await postTogetherChat(retryPayload, options, signal);
  if (retry.ok) {
    return { ok: true, response: retry };
  }
  return { ok: false, status: retry.status, text: await retry.text() };
}

async function postTogetherChat(payload: Record<string, unknown>, options: CodexProxyOptions, signal?: AbortSignal): Promise<Response> {
  return await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
}

function toChatPayload(body: ResponsesRequest, options: CodexProxyOptions, stream: boolean): Record<string, unknown> {
  const messages = toChatMessages(body, options);
  const translatedReasoningEffort = reasoningEffort(body, options);
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
    ...(translatedReasoningEffort ? { reasoning_effort: translatedReasoningEffort } : {}),
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

function reasoningEffort(body: ResponsesRequest, options: CodexProxyOptions): string | undefined {
  const effort = body.reasoning?.effort;
  if (options.targetModelId === "zai-org/GLM-5.2") {
    if (effort === "high" || effort === "xhigh" || effort === "max") {
      return "max";
    }
    return undefined;
  }
  if (effort === "low" || effort === "medium" || effort === "high" || effort === "max") {
    return effort;
  }
  if (effort === "xhigh") {
    return "high";
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
  signal?: AbortSignal,
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

  const upstreamResult = await fetchTogetherChat(toChatPayload(body, options, true), options, signal);
  if (!upstreamResult.ok) {
    writeResponsesSse(res, "response.failed", {
      type: "response.failed",
      response: { id: responseId, status: "failed" },
      error: { message: `Together API returned ${upstreamResult.status}: ${upstreamResult.text.slice(0, 1000)}` },
    });
    res.end();
    return;
  }
  const upstream = upstreamResult.response;
  if (!upstream.body) {
    writeResponsesSse(res, "response.failed", {
      type: "response.failed",
      response: { id: responseId, status: "failed" },
      error: { message: "Together returned no stream body." },
    });
    res.end();
    return;
  }

  const outputState: StreamOutputState = {
    nextOutputIndex: 0,
    reasoningText: "",
    text: "",
  };
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
    const reasoningDelta = delta.reasoning ?? delta.reasoning_content;
    if (reasoningDelta) {
      openReasoningOutputItem(res, outputState);
      outputState.reasoningText += reasoningDelta;
      writeResponsesSse(res, "response.reasoning_text.delta", {
        type: "response.reasoning_text.delta",
        item_id: outputState.reasoningItemId,
        output_index: outputState.reasoningOutputIndex,
        content_index: 0,
        delta: reasoningDelta,
      });
    }
    if (delta.content) {
      openTextOutputItem(res, outputState);
      outputState.text += delta.content;
      writeResponsesSse(res, "response.output_text.delta", {
        type: "response.output_text.delta",
        item_id: outputState.textItemId,
        output_index: outputState.textOutputIndex,
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

  if (outputState.reasoningItemId !== undefined) {
    writeResponsesSse(res, "response.reasoning_text.done", {
      type: "response.reasoning_text.done",
      item_id: outputState.reasoningItemId,
      output_index: outputState.reasoningOutputIndex,
      content_index: 0,
      text: outputState.reasoningText,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.reasoningOutputIndex,
      item: reasoningOutputItem(outputState.reasoningText, outputState.reasoningItemId),
    });
  }

  if (outputState.textItemId !== undefined) {
    writeResponsesSse(res, "response.output_text.done", {
      type: "response.output_text.done",
      item_id: outputState.textItemId,
      output_index: outputState.textOutputIndex,
      content_index: 0,
      text: outputState.text,
    });
    writeResponsesSse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: outputState.textOutputIndex,
      item: messageOutputItem(outputState.text, outputState.textItemId),
    });
  }

  let outputIndex = outputState.nextOutputIndex;
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
        ...(outputState.reasoningItemId !== undefined
          ? [reasoningOutputItem(outputState.reasoningText, outputState.reasoningItemId)]
          : []),
        ...(outputState.textItemId !== undefined
          ? [messageOutputItem(outputState.text, outputState.textItemId)]
          : []),
        ...[...toolCalls.values()].map((toolCall) => functionCallOutputItem(toolCall)),
      ],
      usage: toResponsesUsage(usage),
    },
  });
  res.end();
}

function openReasoningOutputItem(res: ServerResponse, state: StreamOutputState): void {
  if (state.reasoningItemId !== undefined) {
    return;
  }
  state.reasoningItemId = `rs_${randomUUID().replaceAll("-", "")}`;
  state.reasoningOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  writeResponsesSse(res, "response.output_item.added", {
    type: "response.output_item.added",
    output_index: state.reasoningOutputIndex,
    item: { id: state.reasoningItemId, type: "reasoning", status: "in_progress", summary: [], content: [] },
  });
}

function openTextOutputItem(res: ServerResponse, state: StreamOutputState): void {
  if (state.textItemId !== undefined) {
    return;
  }
  state.textItemId = `msg_${randomUUID().replaceAll("-", "")}`;
  state.textOutputIndex = state.nextOutputIndex;
  state.nextOutputIndex += 1;
  const item = { id: state.textItemId, type: "message", role: "assistant", status: "in_progress", content: [] };
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

function reasoningOutputItem(text: string, id = `rs_${randomUUID().replaceAll("-", "")}`): Record<string, unknown> {
  return {
    id,
    type: "reasoning",
    status: "completed",
    summary: [],
    content: [{ type: "reasoning_text", text }],
  };
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
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
    output_tokens_details: {
      reasoning_tokens: reasoningTokens,
    },
  };
}

function recordUsage(usage: ChatResponse["usage"], options: CodexProxyOptions): void {
  if (!usage) {
    return;
  }
  options.costTracker?.addUsage(
    usage.prompt_tokens ?? 0,
    usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0,
    usage.completion_tokens ?? 0,
    options.modelDefinition,
  );
}

function maxTokensForContextLengthRetry(
  message: string,
  options: CodexProxyOptions,
  currentMaxTokens: unknown,
): number | undefined {
  const inputTokens = parseTogetherContextLengthInputTokens(message);
  if (inputTokens === undefined) {
    return undefined;
  }
  const availableOutputTokens = Math.min(options.modelDefinition.limit.context - inputTokens, options.modelDefinition.limit.output);
  if (availableOutputTokens < 1) {
    return undefined;
  }
  const retryMaxTokens = Math.floor(availableOutputTokens);
  if (typeof currentMaxTokens === "number" && retryMaxTokens >= currentMaxTokens) {
    return undefined;
  }
  return retryMaxTokens;
}

function parseTogetherContextLengthInputTokens(message: string): number | undefined {
  const parentheticalMatch = message.match(/maximum context length is\s+[\d,_]+\s+tokens.*?\(([\d,_]+)\s+input\b/is);
  if (parentheticalMatch) {
    return parseTokenCount(parentheticalMatch[1]);
  }
  const resolvedInputMatch = message.match(/request resolved to\s+([\d,_]+)\s+input tokens\b/is);
  return parseTokenCount(resolvedInputMatch?.[1]);
}

function parseTokenCount(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.replaceAll(/[,_]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function summarizeResponsesTools(tools: ResponsesTool[] | undefined): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    name: tool.name,
    type: tool.type,
    parameterKeys: objectKeys(tool.parameters),
    rawKeys: Object.keys(tool),
  }));
}

function objectKeys(value: unknown): string[] | undefined {
  return typeof value === "object" && value !== null ? Object.keys(value) : undefined;
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
  const line = `[togetherlink codex proxy] ${label}: ${JSON.stringify(payload)}\n`;
  process.stderr.write(line);
  if (process.env.TOGETHERLINK_DEBUG_LOG) {
    appendFileSync(process.env.TOGETHERLINK_DEBUG_LOG, line);
  }
}
