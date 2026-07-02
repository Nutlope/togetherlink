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
const CODEX_APPROX_CHARS_PER_TOKEN = 4;

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
      defaultMaxOutputTokens(requestModel.definition, messagesWithNativePrompt, toolTranslation),
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
  const flushPendingToolCalls = () => {
    if (pendingToolCalls.length === 0) {
      return;
    }
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls.splice(0),
    });
  };
  for (const item of body.input ?? []) {
    if (item.type === "function_call") {
      pendingToolCalls.push({
        id: item.call_id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toChatHistoryToolName(item, toolTranslation, "function"),
          arguments: item.arguments ?? "{}",
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
      messages.push({ role, content: toChatMessageContent(item.content) });
    }
  }
  flushPendingToolCalls();
  return messages;
}

function toChatHistoryToolName(
  item: ResponsesInputItem,
  toolTranslation: CodexToolTranslation,
  preferredKind: "function" | "custom",
): string {
  const sourceName = item.name ?? "tool";
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
      if (part.type === "input_text" || part.type === "output_text" || part.type === "text") {
        return part.text ?? "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
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
  messages: ChatMessage[],
  toolTranslation: CodexToolTranslation,
): number {
  const estimatedInputTokens = Math.ceil(
    Buffer.byteLength(JSON.stringify({ messages, tools: toolTranslation.tools }), "utf8") /
      CODEX_APPROX_CHARS_PER_TOKEN,
  );
  const availableOutputTokens = Math.floor(
    modelDefinition.limit.context - estimatedInputTokens - CODEX_CONTEXT_OUTPUT_SAFETY_TOKENS,
  );
  return Math.max(1, Math.min(modelDefinition.limit.output, availableOutputTokens));
}

function debugLog(options: DebugOptions, label: string, payload: unknown | (() => unknown)): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
