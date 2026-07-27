import { GLM_5_2, KIMI_K3, type ModelDefinition } from "@togetherlink/models";
import {
  nativeToolMaxUses as sharedNativeToolMaxUses,
  runExaSearchDetailed as runSharedExaSearchDetailed,
  stringArray,
  withNativeToolSystemPrompt as withSharedNativeToolSystemPrompt,
  type ExaSearchOutcome,
} from "../exa-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import {
  formatToolResultContent,
  formatWebSearchToolResult,
  stringifyAnthropicContent,
} from "./content-format.js";
import { isImageBlock, isUrlImageBlock, toImageUrl } from "./vision.js";
import type {
  AnthropicMessagesRequest,
  AnthropicTool,
  NativeServerTool,
  OpenAIMessage,
  OpenAITool,
} from "./wire-types.js";

type DebugOptions = {
  debug?: boolean | undefined;
};

type TogetherReasoningEffort = "low" | "high" | "max";

const TOGETHERLINK_IDENTITY_PROMPT =
  "You are a Together AI model routed through togetherlink, not Anthropic Claude.";

export function togetherReasoningEffort(
  body: AnthropicMessagesRequest,
  targetModel: ModelDefinition,
): TogetherReasoningEffort | undefined {
  const requestedEffort = body.reasoning_effort ?? body.effort ?? body.thinking?.effort;
  if (targetModel.id === GLM_5_2.id) {
    return normalizeGlmReasoningEffort(requestedEffort);
  }
  if (targetModel.id === KIMI_K3.id) {
    return normalizeKimiK3ReasoningEffort(requestedEffort);
  }
  return undefined;
}

function normalizeGlmReasoningEffort(value: unknown): TogetherReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const effort = value.toLowerCase();
  if (effort === "max" || effort === "xhigh") {
    return "max";
  }
  return undefined;
}

function normalizeKimiK3ReasoningEffort(value: unknown): TogetherReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const effort = value.toLowerCase();
  if (effort === "low" || effort === "high" || effort === "max") {
    return effort;
  }
  if (effort === "xhigh") {
    return "max";
  }
  return undefined;
}

export function toOpenAITools(
  tools: AnthropicTool[] | undefined,
  options?: DebugOptions,
): OpenAITool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  const hasNativeWebSearch = tools.some(isNativeWebSearchTool);
  return tools.flatMap((tool) => {
    if (hasNativeWebSearch && !isNativeWebSearchTool(tool) && tool.name === "web_search") {
      debugLog(options, "dropped colliding custom web_search tool", {
        name: tool.name,
        type: tool.type,
      });
      return [];
    }
    return [
      {
        type: "function",
        function: {
          name: openAIToolName(tool),
          description: tool.description ?? "",
          parameters: toOpenAIToolParameters(tool),
        },
      },
    ];
  });
}

function openAIToolName(tool: AnthropicTool): string {
  return isNativeWebSearchTool(tool) ? "web_search" : (tool.name ?? "tool");
}

function toOpenAIToolParameters(tool: AnthropicTool): unknown {
  if (tool.input_schema) {
    return tool.input_schema;
  }
  if (isNativeWebSearchTool(tool)) {
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

export function toOpenAIToolChoice(toolChoice: unknown): unknown {
  if (!toolChoice || typeof toolChoice !== "object") {
    return undefined;
  }
  const choice = toolChoice as { type?: unknown; name?: unknown };
  if (choice.type === "auto") {
    return "auto";
  }
  if (choice.type === "any") {
    return "required";
  }
  if (choice.type === "tool" && typeof choice.name === "string" && choice.name) {
    return { type: "function", function: { name: choice.name } };
  }
  return undefined;
}

export function nativeServerTools(tools: AnthropicTool[] | undefined): NativeServerTool[] {
  return (tools ?? []).flatMap((tool) => {
    if (!isNativeWebSearchTool(tool)) {
      return [];
    }
    return [{ kind: "web_search", name: "web_search", definition: tool }];
  });
}

function isNativeWebSearchTool(tool: AnthropicTool): boolean {
  return tool.type?.startsWith("web_search") === true;
}

export function claudeNativeToolMaxUses(tool: AnthropicTool): number {
  return sharedNativeToolMaxUses(tool as { max_uses?: unknown });
}

export function withClaudeNativeToolSystemPrompt(
  messages: OpenAIMessage[],
  nativeTools: NativeServerTool[],
): OpenAIMessage[] {
  return withSharedNativeToolSystemPrompt(messages, nativeTools, {
    mergeLeadingSystemMessages,
    toolName: (tool) => tool.name,
  });
}

export async function runClaudeExaSearch(
  input: unknown,
  tool: AnthropicTool,
  options: DebugOptions,
): Promise<ExaSearchOutcome> {
  return runSharedExaSearchDetailed({
    query: input,
    queryKeys: ["query", "q"],
    allowedDomains: stringArray(tool.allowed_domains, { requireTrimmed: false }),
    blockedDomains: stringArray(tool.blocked_domains, { requireTrimmed: false }),
    exaApiKey: process.env.EXA_API_KEY,
    debugLog: (label, value) => debugLog(options, label, value),
    missingApiKeyMessage:
      "Web search error: EXA_API_KEY is not set. Set it in the repo .env (EXA_API_KEY=...) and retry.",
    snippetLength: 600,
  });
}

export function toOpenAIMessages(
  body: AnthropicMessagesRequest,
  targetModel?: ModelDefinition,
): OpenAIMessage[] {
  const systemParts = [
    targetModel
      ? `${TOGETHERLINK_IDENTITY_PROMPT} Backend: ${targetModel.name} (${targetModel.id}).`
      : TOGETHERLINK_IDENTITY_PROMPT,
  ];
  const system = stringifyAnthropicContent(body.system);
  if (system) {
    systemParts.push(system);
  }
  const messages: OpenAIMessage[] = [{ role: "system", content: systemParts.join("\n\n") }];

  for (const message of body.messages ?? []) {
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }

    const textParts: string[] = [];
    const contentParts: NonNullable<Exclude<OpenAIMessage["content"], string | null>> = [];
    let hasImageContent = false;
    const reasoningParts: string[] = [];
    const toolCalls: OpenAIMessage["tool_calls"] = [];
    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
        contentParts.push({ type: "text", text: block.text });
      } else if (targetModel?.attachment && (isImageBlock(block) || isUrlImageBlock(block))) {
        const imageUrl = toImageUrl(block);
        if (imageUrl) {
          contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
          hasImageContent = true;
        }
      } else if (block.type === "thinking") {
        reasoningParts.push(block.thinking);
      } else if (block.type === "redacted_thinking") {
        reasoningParts.push(block.data);
      } else if (block.type === "tool_result") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: formatToolResultContent(block.content, block.is_error),
        });
        if (targetModel?.attachment && Array.isArray(block.content)) {
          let addedToolImageLabel = false;
          for (const innerBlock of block.content) {
            if (!isImageBlock(innerBlock) && !isUrlImageBlock(innerBlock)) {
              continue;
            }
            const imageUrl = toImageUrl(innerBlock);
            if (!imageUrl) {
              continue;
            }
            if (!addedToolImageLabel) {
              contentParts.push({
                type: "text",
                text: `Image returned by tool call ${block.tool_use_id}.`,
              });
              addedToolImageLabel = true;
            }
            contentParts.push({ type: "image_url", image_url: { url: imageUrl } });
            hasImageContent = true;
          }
        }
      } else if (
        block.type === "web_search_tool_result" ||
        block.type === "web_search_tool_result_error"
      ) {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id ?? "web_search",
          content: formatWebSearchToolResult(block),
        });
      } else if (block.type === "tool_use" || block.type === "server_tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }

    const content = hasImageContent ? contentParts : textParts.join("\n");
    if (content.length > 0 || reasoningParts.length > 0 || toolCalls.length > 0) {
      messages.push({
        role: message.role,
        content: typeof content === "string" ? content || null : content,
        ...(reasoningParts.length > 0 ? { reasoning_content: reasoningParts.join("\n") } : {}),
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    }
  }

  return messages;
}

function mergeLeadingSystemMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
  const systemParts: string[] = [];
  let index = 0;
  while (index < messages.length && messages[index]?.role === "system") {
    const content = messages[index]?.content;
    if (typeof content === "string" && content.trim()) {
      systemParts.push(content);
    }
    index += 1;
  }
  if (systemParts.length === 0) {
    return messages.slice(index);
  }
  return [{ role: "system", content: systemParts.join("\n\n") }, ...messages.slice(index)];
}

function debugLog(
  options: DebugOptions | undefined,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
