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
  baseUrl: string;
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

// Python dict methods whose names could collide with a key in tool-call
// arguments when a Together chat template calls `arguments.<method>()`.
// Only `items` has been confirmed to collide (GLM-5.2, MiniMax-M3), but the
// reactive retry sanitizes all of them so an unknown future collision
// self-heals without a code change.
const TEMPLATE_ERROR_DICT_METHODS = new Set([
  "items",
  "keys",
  "values",
  "get",
  "pop",
  "popitem",
  "setdefault",
  "update",
  "clear",
  "copy",
  "fromkeys",
]);

function isTogetherTemplateError(text: string): boolean {
  return /process_messages_failed|not callable|apply chat template|invalid operation/i.test(text);
}

/** Deep-clone just enough of the payload to safely mutate tool-call arguments. */
function cloneMessagesForRetry(messages: unknown): ChatMessage[] {
  const arr = Array.isArray(messages) ? (messages as ChatMessage[]) : [];
  return arr.map((msg) => ({
    ...msg,
    ...(msg.tool_calls
      ? {
          tool_calls: msg.tool_calls.map((tc) => ({
            ...tc,
            function: { ...tc.function },
          })),
        }
      : {}),
  }));
}

/**
 * Rename every top-level dict-method-named key in every tool-call's arguments
 * to `_<name>`. Returns true if anything changed (i.e. a retry is warranted).
 * More aggressive than the proactive `items`-only rename because this only
 * runs after a real upstream failure, so there is no happy-path cost.
 */
function sanitizePayloadForTemplateRetry(payload: Record<string, unknown>): boolean {
  const messages = cloneMessagesForRetry(payload.messages);
  let changed = false;
  for (const message of messages) {
    if (!message.tool_calls) continue;
    for (const toolCall of message.tool_calls) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        let modified = false;
        for (const key of Object.keys(parsed)) {
          if (TEMPLATE_ERROR_DICT_METHODS.has(key)) {
            parsed[`_${key}`] = parsed[key];
            delete parsed[key];
            modified = true;
          }
        }
        if (modified) {
          toolCall.function.arguments = JSON.stringify(parsed);
          changed = true;
        }
      } catch {
        // Not valid JSON -- skip this tool call.
      }
    }
  }
  if (changed) {
    payload.messages = messages;
  }
  return changed;
}

export async function fetchTogetherChat(
  payload: Record<string, unknown>,
  options: CodexTogetherOptions,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
): Promise<TogetherChatResult> {
  const first = await postTogetherChat(payload, options, modelDefinition, signal);
  if (first.ok) {
    return { ok: true, response: first };
  }
  // The shared Together client already self-healed any context-length overflow
  // (max_tokens → strip old images → trim text → drop oldest turns) before
  // returning, so anything non-OK here is either terminal or a template crash.
  const text = await first.text();

  // Template-error self-healing: if Together's chat template crashed on a
  // dict-method-named key in tool-call arguments (e.g. `items`), sanitize all
  // such keys and retry once. This is the reactive backstop behind the
  // proactive `items`-only rename in translate-request.ts -- it catches any
  // future unknown collision without a code change.
  if (isTogetherTemplateError(text)) {
    const sanitized: Record<string, unknown> = { ...payload };
    if (sanitizePayloadForTemplateRetry(sanitized)) {
      debugLog(options, "retrying together request after template-error sanitization", {
        model: sanitized.model,
        originalError: text.slice(0, 1000),
      });
      const retry = await postTogetherChat(sanitized, options, modelDefinition, signal);
      if (retry.ok) {
        return { ok: true, response: retry };
      }
      return { ok: false, status: retry.status, text: await retry.text() };
    }
  }

  return { ok: false, status: first.status, text };
}

async function postTogetherChat(
  payload: Record<string, unknown>,
  options: CodexTogetherOptions,
  modelDefinition: ModelDefinition,
  signal?: AbortSignal,
): Promise<Response> {
  // Delegate the fetch + 429/503 retry loop AND the reactive context-fit retry
  // to the shared Together client (together-client.ts). Passing the model
  // definition enables the context-fit repair; this harness keeps only the
  // Codex-specific debug logging and template-error handling on top.
  return postChatCompletion(payload, options, signal, { modelDefinition, debug: options.debug });
}

function debugLog(
  options: CodexTogetherOptions,
  label: string,
  payload: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink codex proxy", options, label, payload);
}
