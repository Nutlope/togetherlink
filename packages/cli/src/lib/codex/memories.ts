import type { ModelDefinition } from "@togetherlink/models";
import { callTogetherWithNativeTools } from "./together-call.js";
import { codexReasoningEffort, EMPTY_CODEX_TOOL_TRANSLATION } from "./translate-request.js";
import type { ChatResponse } from "./wire-types.js";

const MEMORY_MAX_OUTPUT_TOKENS = 4_096;

const MEMORY_SYSTEM_PROMPT = `You summarize one Codex task trace for durable memory.

Return one JSON object with exactly two string fields:
- "trace_summary": a faithful, concrete summary of what happened in the trace.
- "memory_summary": the durable decisions, preferences, constraints, and reusable lessons worth retaining.

Do not call tools. Do not wrap the JSON in markdown.`;

export type CodexMemoryTrace = {
  id: string;
  metadata: { source_path: string };
  items: unknown[];
};

export type CodexMemoriesRequest = {
  model?: string;
  traces: CodexMemoryTrace[];
  reasoning?: { effort?: string | null } | null;
};

export type CodexMemoryOutput = {
  trace_summary: string;
  memory_summary: string;
};

export function invalidMemoryTraces(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return "traces must be an array";
  }
  for (const [index, trace] of value.entries()) {
    if (
      !trace ||
      typeof trace !== "object" ||
      typeof (trace as CodexMemoryTrace).id !== "string" ||
      !(trace as CodexMemoryTrace).metadata ||
      typeof (trace as CodexMemoryTrace).metadata !== "object" ||
      typeof (trace as CodexMemoryTrace).metadata.source_path !== "string" ||
      !Array.isArray((trace as CodexMemoryTrace).items)
    ) {
      return `traces[${index}] must contain a string id, metadata.source_path, and an items array`;
    }
  }
  return undefined;
}

type TogetherMemoryOptions = {
  apiKey: string;
  baseUrl: string;
  debug?: boolean | undefined;
};

export async function summarizeTogetherMemories(
  body: CodexMemoriesRequest,
  targetModelId: string,
  modelDefinition: ModelDefinition,
  options: TogetherMemoryOptions,
  signal?: AbortSignal,
  onUsage?: (usage: ChatResponse["usage"]) => void,
): Promise<{ output: CodexMemoryOutput[] }> {
  const output: CodexMemoryOutput[] = [];
  for (const trace of body.traces) {
    const response = await callTogetherWithNativeTools(
      memoryPayload(trace, body.reasoning, targetModelId, modelDefinition),
      EMPTY_CODEX_TOOL_TRANSLATION,
      options,
      modelDefinition,
      signal,
    );
    output.push(memoryOutput(response));
    onUsage?.(response.usage);
  }
  return { output };
}

function memoryPayload(
  trace: CodexMemoryTrace,
  reasoning: CodexMemoriesRequest["reasoning"],
  targetModelId: string,
  modelDefinition: ModelDefinition,
): Record<string, unknown> {
  const reasoningEffort = codexReasoningEffort(reasoning, modelDefinition);
  return {
    model: targetModelId,
    messages: [
      { role: "system", content: MEMORY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(trace) },
    ],
    max_tokens: Math.min(MEMORY_MAX_OUTPUT_TOKENS, modelDefinition.limit.output),
    tools: [],
    tool_choice: "none",
    response_format: { type: "json_object" },
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
    chat_template_kwargs: { clear_thinking: false },
    stream: false,
  };
}

function memoryOutput(response: ChatResponse): CodexMemoryOutput {
  const content = response.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseMemoryJson(content);
  if (parsed) {
    return parsed;
  }
  const fallback = content || "(no memory summary available)";
  return { trace_summary: fallback, memory_summary: fallback };
}

function parseMemoryJson(content: string): CodexMemoryOutput | undefined {
  const unfenced = content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    const value = JSON.parse(unfenced) as Record<string, unknown>;
    if (typeof value.trace_summary !== "string" || typeof value.memory_summary !== "string") {
      return undefined;
    }
    return {
      trace_summary: value.trace_summary,
      memory_summary: value.memory_summary,
    };
  } catch {
    return undefined;
  }
}
