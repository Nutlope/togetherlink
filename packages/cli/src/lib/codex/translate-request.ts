import { randomUUID } from "node:crypto";
import { findModelById, MINIMAX_M3, type ModelDefinition } from "@togetherlink/models";
import { writeProxyDebugLog } from "../proxy-debug.js";
import {
  nativeToolMaxUses as sharedNativeToolMaxUses,
  runExaSearch as runSharedExaSearch,
  stringArray,
  withNativeToolSystemPrompt as withSharedNativeToolSystemPrompt,
} from "../exa-search.js";
import { stringifyUnknown } from "./content-format.js";
import type {
  ChatContentPart,
  ChatMessage,
  CodexToolMapping,
  CodexToolTranslation,
  ResponsesInputItem,
  ResponsesRequest,
  ResponsesTextConfig,
  ResponsesTool,
} from "./wire-types.js";

const CODEX_IDENTITY_PROMPT =
  "You are running inside Codex through togetherlink's local Responses-to-Together proxy. " +
  "The upstream model is a Together AI model, not an OpenAI model. " +
  "If asked what model you are, identify yourself as the selected Together AI backend routed by togetherlink.";

const CODEX_MEMORY_MODEL_ENV = "TOGETHERLINK_CODEX_MEMORY_MODEL";
const CODEX_MEMORY_REQUESTED_MODELS = new Set(["gpt-5.4-mini"]);
const CODEX_CONTEXT_OUTPUT_SAFETY_TOKENS = 512;

export const EMPTY_CODEX_TOOL_TRANSLATION: CodexToolTranslation = {
  tools: [],
  mappings: new Map(),
  nativeTools: [],
};

export type ResolvedCodexRequestModel = {
  requestedModelId: string;
  targetModelId: string;
  definition: ModelDefinition;
  memory: boolean;
};

type CodexTranslateOptions = {
  modelId: string;
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  debug?: boolean | undefined;
};

type DebugOptions = {
  debug?: boolean | undefined;
};

export function toChatPayload(
  body: ResponsesRequest,
  options: CodexTranslateOptions,
  stream: boolean,
  toolTranslation: CodexToolTranslation,
  requestModel: ResolvedCodexRequestModel,
  estimatedInputTokens: number,
): Record<string, unknown> {
  const messages = toChatMessages(body, options, toolTranslation);
  const translatedReasoningEffort = reasoningEffort(body, requestModel.definition);
  const messagesWithNativePrompt =
    toolTranslation.nativeTools.length > 0
      ? withNativeToolSystemPrompt(messages, toolTranslation.nativeTools)
      : messages;
  return {
    model: requestModel.targetModelId,
    messages: messagesWithNativePrompt,
    max_tokens:
      body.max_output_tokens ??
      defaultMaxOutputTokens(requestModel.definition, estimatedInputTokens),
    temperature: body.temperature,
    ...(toolTranslation.tools.length > 0 ? { tools: toolTranslation.tools } : {}),
    tool_choice: toChatToolChoice(body.tool_choice, toolTranslation),
    response_format: toChatResponseFormat(body.text),
    ...(translatedReasoningEffort ? { reasoning_effort: translatedReasoningEffort } : {}),
    chat_template_kwargs: { clear_thinking: false },
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

export function resolveCodexRequestModel(
  body: ResponsesRequest,
  options: CodexTranslateOptions,
): ResolvedCodexRequestModel {
  const requestedModelId = body.model ?? options.modelId;
  if (isCodexMemoryRequest(body, requestedModelId)) {
    const configured = process.env[CODEX_MEMORY_MODEL_ENV]?.trim();
    const configuredModel = configured ? findModelById(configured) : undefined;
    const definition = configuredModel ?? MINIMAX_M3;
    return {
      requestedModelId,
      targetModelId: definition.id,
      definition,
      memory: true,
    };
  }

  const requestedModel = findModelById(requestedModelId);
  const definition = requestedModel ?? options.modelDefinition;
  return {
    requestedModelId,
    targetModelId: definition.id,
    definition,
    memory: false,
  };
}

function isCodexMemoryRequest(body: ResponsesRequest, requestedModelId: string): boolean {
  if (CODEX_MEMORY_REQUESTED_MODELS.has(requestedModelId)) {
    return true;
  }
  return body.instructions?.includes("## Memory Writing Agent:") === true;
}

function toChatMessages(
  body: ResponsesRequest,
  options: CodexTranslateOptions,
  toolTranslation: CodexToolTranslation,
): ChatMessage[] {
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
  const pendingToolCalls: NonNullable<ChatMessage["tool_calls"]> = [];
  const pendingReasoningParts: string[] = [];
  const takePendingReasoning = () => {
    const reasoning = pendingReasoningParts.join("\n");
    pendingReasoningParts.length = 0;
    return reasoning;
  };
  const flushPendingToolCalls = () => {
    if (pendingToolCalls.length === 0) {
      return;
    }
    const reasoning = takePendingReasoning();
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls.splice(0),
      ...(reasoning ? { reasoning_content: reasoning } : {}),
    });
  };
  for (const item of body.input ?? []) {
    if (item.type === "reasoning") {
      const reasoning = stringifyResponsesContent(item.content);
      if (reasoning) {
        pendingReasoningParts.push(reasoning);
      }
      continue;
    }
    if (item.type === "function_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "function"),
          arguments: sanitizeToolCallArguments(
            typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments),
          ),
        },
      });
      continue;
    }
    if (item.type === "tool_search_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "tool_search"),
          arguments:
            typeof item.arguments === "string"
              ? item.arguments
              : JSON.stringify(item.arguments ?? {}),
        },
      });
      continue;
    }
    if (item.type === "custom_tool_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "custom"),
          arguments: JSON.stringify({ input: item.input ?? "" }),
        },
      });
      continue;
    }
    flushPendingToolCalls();
    if (item.type === "tool_search_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id ?? "",
        content: `Loaded tools: ${
          (item.tools ?? [])
            .map((tool) => tool.name)
            .filter(Boolean)
            .join(", ") || "none"
        }`,
      });
      continue;
    }
    if (item.type === "function_call_output" || item.type === "custom_tool_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id ?? "",
        content: stringifyUnknown(item.output),
      });
      continue;
    }
    if (item.type === "message" || item.role) {
      const role = toChatRole(item.role);
      const reasoning = role === "assistant" ? takePendingReasoning() : "";
      messages.push({
        role,
        content: toChatMessageContent(item.content),
        ...(reasoning ? { reasoning_content: reasoning } : {}),
      });
    }
  }
  flushPendingToolCalls();
  return messages;
}

function toChatHistoryToolName(
  item: ResponsesInputItem,
  toolTranslation: CodexToolTranslation,
  preferredKind: "function" | "custom" | "tool_search",
): string {
  const sourceName = item.name ?? (preferredKind === "tool_search" ? "tool_search" : "tool");
  for (const mapping of toolTranslation.mappings.values()) {
    if (
      item.namespace &&
      mapping.kind === "namespace" &&
      mapping.namespace === item.namespace &&
      mapping.sourceName === sourceName
    ) {
      return mapping.modelName;
    }
    if (!item.namespace && mapping.kind === preferredKind && mapping.sourceName === sourceName) {
      return mapping.modelName;
    }
  }
  return item.namespace
    ? `${sanitizeToolName(item.namespace)}__${sanitizeToolName(sourceName)}`
    : sourceName;
}

export function translateCodexTools(tools: ResponsesTool[] | undefined): CodexToolTranslation {
  const translated: CodexToolTranslation["tools"] = [];
  const mappings = new Map<string, CodexToolMapping>();
  const nativeTools: CodexToolMapping[] = [];
  const usedNames = new Set<string>();
  const uniqueName = (raw: string) => {
    const base = sanitizeToolName(raw);
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };

  for (const tool of tools ?? []) {
    if (tool.type === "tool_search") {
      const sourceName = tool.name ?? "tool_search";
      const modelName = uniqueName(sourceName);
      const mapping: CodexToolMapping = {
        kind: "tool_search",
        sourceName,
        modelName,
        execution: tool.execution ?? "client",
      };
      mappings.set(modelName, mapping);
      translated.push(
        toChatFunctionTool(
          modelName,
          tool.description ?? "Search for tools relevant to the current task.",
          tool.parameters,
        ),
      );
      continue;
    }

    if (isWebSearchTool(tool)) {
      const sourceName = tool.name ?? "web_search";
      const modelName = uniqueName(sourceName);
      const mapping: CodexToolMapping = {
        kind: "web_search",
        sourceName,
        modelName,
        definition: tool,
      };
      mappings.set(modelName, mapping);
      nativeTools.push(mapping);
      translated.push(
        toChatFunctionTool(
          modelName,
          tool.description ?? "Search the web for recent or source-backed information.",
          {
            type: "object",
            properties: { query: { type: "string", description: "The web search query." } },
            required: ["query"],
            additionalProperties: false,
          },
        ),
      );
      continue;
    }

    if (tool.type === "function" && tool.name) {
      const modelName = uniqueName(tool.name);
      const mapping: CodexToolMapping = { kind: "function", sourceName: tool.name, modelName };
      mappings.set(modelName, mapping);
      translated.push(toChatFunctionTool(modelName, tool.description ?? "", tool.parameters));
      continue;
    }

    if (tool.type === "custom" && tool.name) {
      const modelName = uniqueName(tool.name);
      const mapping: CodexToolMapping = { kind: "custom", sourceName: tool.name, modelName };
      mappings.set(modelName, mapping);
      translated.push(
        toChatFunctionTool(modelName, customToolDescription(tool), {
          type: "object",
          properties: {
            input: { type: "string", description: "The complete freeform input for this tool." },
          },
          required: ["input"],
          additionalProperties: false,
        }),
      );
      continue;
    }

    if (tool.type === "namespace" && tool.name && Array.isArray(tool.tools)) {
      for (const child of tool.tools) {
        if (child.type !== "function" || !child.name) {
          continue;
        }
        const modelName = uniqueName(`${tool.name}__${child.name}`);
        const mapping: CodexToolMapping = {
          kind: "namespace",
          sourceName: child.name,
          modelName,
          namespace: tool.name,
        };
        mappings.set(modelName, mapping);
        const description = [tool.description, child.description].filter(Boolean).join("\n\n");
        translated.push(toChatFunctionTool(modelName, description, child.parameters));
      }
      continue;
    }
  }

  return { tools: translated, mappings, nativeTools };
}

export function translateCodexRequestTools(body: ResponsesRequest): CodexToolTranslation {
  const visibleTools = (body.tools ?? []).filter((tool) => tool.defer_loading !== true);
  const discoveredTools =
    typeof body.input === "string"
      ? []
      : (body.input ?? []).flatMap((item) =>
          item.type === "tool_search_output" ? (item.tools ?? []) : [],
        );
  const combined = [...visibleTools];
  const seen = new Set(combined.map(toolIdentity));
  for (const tool of discoveredTools) {
    const identity = toolIdentity(tool);
    if (!seen.has(identity)) {
      combined.push(tool);
      seen.add(identity);
    }
  }
  return combined.length > 0 ? translateCodexTools(combined) : EMPTY_CODEX_TOOL_TRANSLATION;
}

function toolIdentity(tool: ResponsesTool): string {
  return `${tool.type ?? ""}:${tool.name ?? ""}`;
}

function toChatFunctionTool(
  name: string,
  description: string,
  parameters: unknown,
): { type: "function"; function: { name: string; description: string; parameters: unknown } } {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: parameters ?? { type: "object", properties: {} },
    },
  };
}

function sanitizeToolName(name: string): string {
  const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "tool";
}

function customToolDescription(tool: ResponsesTool): string {
  const pieces = [tool.description ?? ""];
  if (tool.format?.syntax || tool.format?.definition) {
    pieces.push(
      `Input format: ${[tool.format.syntax, tool.format.definition].filter(Boolean).join("\n")}`,
    );
  }
  return pieces.filter(Boolean).join("\n\n") || "Call this custom freeform tool.";
}

function isWebSearchTool(tool: ResponsesTool): boolean {
  return (
    tool.type === "web_search" ||
    tool.type?.startsWith("web_search") === true ||
    tool.name === "web_search"
  );
}

function withNativeToolSystemPrompt(
  messages: ChatMessage[],
  nativeTools: CodexToolMapping[],
): ChatMessage[] {
  return withSharedNativeToolSystemPrompt(messages, nativeTools, {
    toolName: (tool) => tool.modelName,
  });
}

export function codexNativeToolMaxUses(tool: ResponsesTool): number {
  return sharedNativeToolMaxUses(tool as { max_uses?: unknown });
}

export async function runCodexExaSearch(
  input: unknown,
  tool: ResponsesTool,
  options: DebugOptions,
): Promise<string> {
  return runSharedExaSearch({
    query: input,
    allowedDomains: stringArray((tool as { allowed_domains?: unknown }).allowed_domains),
    blockedDomains: stringArray((tool as { blocked_domains?: unknown }).blocked_domains),
    exaApiKey: process.env.EXA_API_KEY,
    debugLog: (label, value) => debugLog(options, label, value),
    missingApiKeyMessage:
      "Web search error: EXA_API_KEY is not set. Run `togetherlink configure` or export EXA_API_KEY and retry.",
    includePublishedDate: true,
    snippetLength: 700,
  });
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
      if (
        part.type === "input_text" ||
        part.type === "output_text" ||
        part.type === "text" ||
        part.type === "reasoning_text"
      ) {
        return part.text ?? "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Several Together chat templates render tool-call arguments with
 * `arguments.items()` (Python dict-method syntax). In their Jinja environment
 * key lookup on the parsed-JSON object takes precedence over attribute access,
 * so when `arguments` has a top-level `items` key the expression resolves to
 * the *value* of that key instead of the dict method, then `()` tries to call
 * it -- crashing the template with `invalid operation: object is not callable`
 * and a `process_messages_failed` HTTP 400. Confirmed on GLM-5.2
 * (`in chat:85`) and MiniMax-M3 (`in chat:226`); other models may share it.
 *
 * The multi-agent `spawn_agent` tool legitimately puts sub-agent input in an
 * `items` array, so once such a call enters conversation history it bricks
 * every later turn on an affected model (Codex retries the identical payload
 * and hits the identical non-retryable 400).
 *
 * Defensively rename a top-level `items` key to `_items` for ALL models before
 * forwarding. These arguments only appear in conversation history -- the tool
 * already executed against the original arguments Codex captured from the live
 * response -- so renaming what the model sees back is safe and does not affect
 * tool execution. Applied universally (not per-model) because the template bug
 * is upstream and we cannot predict which models carry it; a stale allowlist
 * silently left MiniMax-M3 unprotected until a live probe caught it.
 */
function sanitizeToolCallArguments(argumentsJson: string | undefined): string {
  if (!argumentsJson) {
    return "{}";
  }
  try {
    const parsed = JSON.parse(argumentsJson);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.prototype.hasOwnProperty.call(parsed, "items")
    ) {
      parsed._items = parsed.items;
      delete parsed.items;
      return JSON.stringify(parsed);
    }
  } catch {
    // Not valid JSON -- forward the raw string as-is.
  }
  return argumentsJson;
}

function toChatMessageContent(
  content: ResponsesInputItem["content"],
): string | ChatContentPart[] | null {
  if (typeof content === "string") {
    return content;
  }
  const parts = content ?? [];
  if (!parts.some((part) => part.type === "input_image" || part.type === "image_url")) {
    return stringifyResponsesContent(parts);
  }
  return parts
    .map((part): ChatContentPart | undefined => {
      if (part.type === "input_text" || part.type === "output_text" || part.type === "text") {
        return part.text ? { type: "text", text: part.text } : undefined;
      }
      if (
        (part.type === "input_image" || part.type === "image_url") &&
        typeof part.image_url === "string"
      ) {
        return {
          type: "image_url",
          image_url: {
            url: part.image_url,
            ...(part.detail ? { detail: part.detail } : {}),
          },
        };
      }
      return undefined;
    })
    .filter((part): part is ChatContentPart => part !== undefined);
}

function toChatToolChoice(toolChoice: unknown, toolTranslation: CodexToolTranslation): unknown {
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
    return {
      type: "function",
      function: { name: toChatToolChoiceName(choice.name, toolTranslation) },
    };
  }
  return undefined;
}

function toChatToolChoiceName(name: string, toolTranslation: CodexToolTranslation): string {
  if (toolTranslation.mappings.has(name)) {
    return name;
  }
  for (const mapping of toolTranslation.mappings.values()) {
    if (mapping.sourceName === name) {
      return mapping.modelName;
    }
  }
  return name;
}

function toChatResponseFormat(text: ResponsesTextConfig | undefined): unknown {
  const format = text?.format;
  if (!format?.type) {
    return undefined;
  }
  if (format.type === "json_schema") {
    return {
      type: "json_schema",
      json_schema: {
        name: format.name ?? "codex_output_schema",
        ...(format.schema !== undefined ? { schema: format.schema } : {}),
        ...(format.strict !== undefined ? { strict: format.strict } : {}),
      },
    };
  }
  if (format.type === "json_object") {
    return { type: "json_object" };
  }
  return undefined;
}

function reasoningEffort(body: ResponsesRequest, model: ModelDefinition): string | undefined {
  const effort = body.reasoning?.effort;
  if (!model.reasoning) {
    return undefined;
  }
  if (model.id === "zai-org/GLM-5.2") {
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

function defaultMaxOutputTokens(
  modelDefinition: ModelDefinition,
  estimatedInputTokens: number,
): number {
  // Fast path: when the estimate says we are comfortably inside the window,
  // skip the clamp arithmetic and return the full output budget directly. The
  // 1.15 factor is the headroom that accounts for estimation error (the
  // calibrated ratio is good but not exact). This is the ~95% of turns where
  // the session is nowhere near the context window — the budget check is now
  // two comparisons, no payload serialization.
  if (
    estimatedInputTokens * 1.15 +
      modelDefinition.limit.output +
      CODEX_CONTEXT_OUTPUT_SAFETY_TOKENS <
    modelDefinition.limit.context
  ) {
    return modelDefinition.limit.output;
  }
  // Near the window: clamp max_tokens down so input + max_tokens stays inside
  // the context window, with a safety margin. The reactive 400-retry path in
  // together-call.ts (maxTokensForContextLengthRetry) remains the accuracy
  // backstop — it parses Together's exact token counts from the error.
  const availableOutputTokens = Math.floor(
    modelDefinition.limit.context - estimatedInputTokens - CODEX_CONTEXT_OUTPUT_SAFETY_TOKENS,
  );
  return Math.max(1, Math.min(modelDefinition.limit.output, availableOutputTokens));
}

function debugLog(options: DebugOptions, label: string, payload: unknown | (() => unknown)): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
