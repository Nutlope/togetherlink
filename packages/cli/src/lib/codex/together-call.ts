import { randomUUID } from "node:crypto";
import { type ModelDefinition } from "@togetherlink/models";
import { runNativeWebSearchCall } from "../native-web-search.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { postChatCompletion } from "../together-client.js";
import { parseJsonOrEmpty } from "./content-format.js";
import { codexNativeToolMaxUses, runCodexExaSearch } from "./translate-request.js";
import type {
  ChatMessage,
  ChatResponse,
  CodexToolTranslation,
  TogetherChatResult,
} from "./wire-types.js";

type CodexTogetherOptions = {
  apiKey: string;
  debug?: boolean | undefined;
};

async function callTogether(
  payload: Record<string, unknown>,
  options: CodexTogetherOptions,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const result = await fetchTogetherChat(payload, options, modelDefinition, signal);
  if (!result.ok) {
    throw new Error(`Together API returned ${result.status}: ${result.text.slice(0, 1000)}`);
  }
  return (await result.response.json()) as ChatResponse;
}

export async function callTogetherWithNativeTools(
  payload: Record<string, unknown>,
  toolTranslation: CodexToolTranslation,
  options: CodexTogetherOptions,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  if (toolTranslation.nativeTools.length === 0) {
    return callTogether(payload, options, modelDefinition, signal);
  }

  const messages = Array.isArray(payload.messages)
    ? ([...(payload.messages as ChatMessage[])] as ChatMessage[])
    : [];
  const nativeToolNames = new Set(toolTranslation.nativeTools.map((tool) => tool.modelName));
  const nativeToolUses = new Map<string, number>();

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const json = await callTogether({ ...payload, messages }, options, modelDefinition, signal);
    const toolCalls = json.choices?.[0]?.message?.tool_calls ?? [];
    const nativeToolCalls = toolCalls.filter((toolCall) =>
      nativeToolNames.has(toolCall.function?.name ?? ""),
    );
    if (nativeToolCalls.length === 0) {
      return json;
    }
    if (nativeToolCalls.length !== toolCalls.length) {
      const message = json.choices?.[0]?.message;
      if (message) {
        const nativeResults: string[] = [];
        for (const toolCall of nativeToolCalls) {
          const name = toolCall.function?.name ?? "web_search";
          const nativeTool = toolTranslation.mappings.get(name);
          const input = parseJsonOrEmpty(toolCall.function?.arguments);
          const priorUses = nativeToolUses.get(name) ?? 0;
          const webSearchDefinition =
            nativeTool?.kind === "web_search" ? nativeTool.definition : undefined;
          const maxUses =
            webSearchDefinition !== undefined ? codexNativeToolMaxUses(webSearchDefinition) : 0;
          const result = await runNativeWebSearchCall({
            name,
            priorUses,
            maxUses,
            isWebSearch: webSearchDefinition !== undefined,
            recordUse: () => nativeToolUses.set(name, priorUses + 1),
            runSearch: () => runCodexExaSearch(input, webSearchDefinition!, options),
          });
          nativeResults.push(`Native ${name} result:\n${result}`);
        }
        message.tool_calls = toolCalls.filter(
          (toolCall) => !nativeToolNames.has(toolCall.function?.name ?? ""),
        );
        message.content =
          [message.content?.trim(), ...nativeResults].filter(Boolean).join("\n\n") || null;
      }
      return json;
    }

    const reasoning =
      json.choices?.[0]?.message?.reasoning ?? json.choices?.[0]?.message?.reasoning_content;
    messages.push({
      role: "assistant",
      content: json.choices?.[0]?.message?.content ?? null,
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`,
        type: "function",
        function: {
          name: toolCall.function?.name ?? "tool",
          arguments: toolCall.function?.arguments ?? "{}",
        },
      })),
      ...(reasoning ? { reasoning_content: reasoning } : {}),
    });

    for (const toolCall of nativeToolCalls) {
      const id = toolCall.id ?? `call_${randomUUID().replaceAll("-", "")}`;
      const name = toolCall.function?.name ?? "web_search";
      const nativeTool = toolTranslation.mappings.get(name);
      const input = parseJsonOrEmpty(toolCall.function?.arguments);
      const priorUses = nativeToolUses.get(name) ?? 0;
      const webSearchDefinition =
        nativeTool?.kind === "web_search" ? nativeTool.definition : undefined;
      const maxUses =
        webSearchDefinition !== undefined ? codexNativeToolMaxUses(webSearchDefinition) : 0;
      const result = await runNativeWebSearchCall({
        name,
        priorUses,
        maxUses,
        isWebSearch: webSearchDefinition !== undefined,
        recordUse: () => nativeToolUses.set(name, priorUses + 1),
        runSearch: () => runCodexExaSearch(input, webSearchDefinition!, options),
      });
      messages.push({ role: "tool", tool_call_id: id, content: result });
    }
  }

  return {
    id: `chatcmpl_${randomUUID().replaceAll("-", "")}`,
    choices: [
      {
        finish_reason: "stop",
        message: {
          content:
            "I could not complete native web search because the model kept requesting additional search tool calls.",
        },
      },
    ],
  };
}

export async function fetchTogetherChat(
  payload: Record<string, unknown>,
  options: CodexTogetherOptions,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
): Promise<TogetherChatResult> {
  const first = await postTogetherChat(payload, options, signal);
  if (first.ok) {
    return { ok: true, response: first };
  }
  const text = await first.text();
  const retryMaxTokens = maxTokensForContextLengthRetry(text, modelDefinition, payload.max_tokens);
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

async function postTogetherChat(
  payload: Record<string, unknown>,
  options: CodexTogetherOptions,
  signal?: AbortSignal,
): Promise<Response> {
  // Delegate the fetch + 429/503 retry loop to the shared Together client
  // (together-client.ts). The retry contract (serialize-once, Retry-After,
  // exponential backoff) lives in one place; this harness keeps only the
  // Codex-specific debug logging and error mapping on top.
  return postChatCompletion(payload, options, signal);
}

function maxTokensForContextLengthRetry(
  message: string,
  modelDefinition: ModelDefinition,
  currentMaxTokens: unknown,
): number | undefined {
  const inputTokens = parseTogetherContextLengthInputTokens(message);
  if (inputTokens === undefined) {
    return undefined;
  }
  const availableOutputTokens = Math.min(
    modelDefinition.limit.context - inputTokens,
    modelDefinition.limit.output,
  );
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
  const parentheticalMatch = message.match(
    /maximum context length is\s+[\d,_]+\s+tokens.*?\(([\d,_]+)\s+input\b/is,
  );
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

function debugLog(
  options: CodexTogetherOptions,
  label: string,
  payload: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
