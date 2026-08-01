import { type ModelDefinition, type ModelReasoningEffort } from "@togetherlink/models";
import { CODEX_SUPPORTED_MODELS } from "./defaults.js";

const CODEX_BASE_INSTRUCTIONS =
  "You are Codex, a coding agent. You and the user share one workspace, and your job is to help them complete their coding task accurately and efficiently.";

// Match the native Codex catalog's per-tool-output truncation policy. This is
// not the model context window; Codex owns conversation compaction separately.
const CODEX_TOOL_OUTPUT_TRUNCATION_TOKENS = 10_000;
const CODEX_EFFECTIVE_CONTEXT_WINDOW_PERCENT = 95;

const CODEX_MODEL_MESSAGES = {
  instructions_template: `${CODEX_BASE_INSTRUCTIONS}\n\n{{ personality }}`,
  instructions_variables: {
    personality_default: "",
    personality_friendly:
      "# Personality\n\nYou are warm, collaborative, and helpful. Keep the user clearly informed while you work, and make the collaboration feel easy.",
    personality_pragmatic:
      "# Personality\n\nYou are direct, task-focused, and precise. State assumptions clearly, prioritize actionable progress, and avoid unnecessary detail.",
  },
};

export type CodexModelCatalog = { models: Array<Record<string, unknown>> };

export function codexModelCatalog(): CodexModelCatalog {
  return {
    models: CODEX_SUPPORTED_MODELS.map((model, index) => toCodexModelCatalogEntry(model, index)),
  };
}

/**
 * Add Together models to a native Codex catalog without rewriting native
 * metadata. Together entries are placed after the native picker rows so
 * enabling TogetherLink does not silently change the user's GPT default.
 */
export function mergeCodexModelCatalog(nativeCatalog: CodexModelCatalog): CodexModelCatalog {
  const nativeModels = nativeCatalog.models.filter(
    (entry) => typeof entry?.slug === "string" && entry.slug.length > 0,
  );
  if (nativeModels.length === 0) {
    throw new Error("Cannot build an additive Codex catalog from an empty native catalog.");
  }
  const priorities = nativeModels
    .map((entry) => entry.priority)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const firstTogetherPriority = (priorities.length > 0 ? Math.max(...priorities) : 50) + 1;
  const merged = new Map(nativeModels.map((entry) => [String(entry.slug), entry]));
  CODEX_SUPPORTED_MODELS.forEach((model, index) => {
    merged.set(model.id, toCodexModelCatalogEntry(model, firstTogetherPriority + index));
  });
  return {
    models: [...merged.values()].sort((left, right) => {
      const priority =
        Number(left.priority ?? Number.MAX_SAFE_INTEGER) -
        Number(right.priority ?? Number.MAX_SAFE_INTEGER);
      return priority || String(left.slug).localeCompare(String(right.slug));
    }),
  };
}

export function codexModelCatalogJson(): string {
  return JSON.stringify(codexModelCatalog());
}

export function toCodexModelCatalogEntry(
  model: { id: string; definition: ModelDefinition },
  priority = 50,
): Record<string, unknown> {
  const efforts = model.definition.reasoning
    ? (model.definition.reasoningEfforts ?? ["low", "medium", "high"])
    : [];
  const reasoningLevels = efforts.map((effort) => ({
    effort,
    description: reasoningEffortDescription(effort),
  }));
  const defaultReasoningLevel = model.definition.reasoning
    ? (model.definition.defaultReasoningEffort ?? "medium")
    : "none";
  return {
    slug: model.id,
    display_name: model.definition.name,
    description: `Together AI model via togetherlink (${model.definition.id})`,
    default_reasoning_level: defaultReasoningLevel,
    supported_reasoning_levels: reasoningLevels,
    shell_type: "shell_command",
    visibility: "list",
    supported_in_api: true,
    priority,
    additional_speed_tiers: [],
    service_tiers: [],
    default_service_tier: null,
    availability_nux: null,
    upgrade: null,
    base_instructions: CODEX_BASE_INSTRUCTIONS,
    model_messages: CODEX_MODEL_MESSAGES,
    supports_personality: true,
    supports_reasoning_summaries: model.definition.reasoning,
    default_reasoning_summary: model.definition.reasoning ? "auto" : "none",
    support_verbosity: false,
    default_verbosity: "low",
    apply_patch_tool_type: "freeform",
    web_search_tool_type: "text_and_image",
    truncation_policy: {
      mode: "tokens",
      limit: CODEX_TOOL_OUTPUT_TRUNCATION_TOKENS,
    },
    supports_parallel_tool_calls: model.definition.tool_call,
    supports_image_detail_original: model.definition.attachment,
    context_window: model.definition.limit.context,
    max_context_window: model.definition.limit.context,
    auto_compact_token_limit: model.definition.codexAutoCompactTokenLimit,
    comp_hash: null,
    effective_context_window_percent: CODEX_EFFECTIVE_CONTEXT_WINDOW_PERCENT,
    experimental_supported_tools: [],
    input_modalities: model.definition.modalities.input,
    supports_search_tool: model.definition.tool_call,
    use_responses_lite: false,
  };
}

function reasoningEffortDescription(effort: ModelReasoningEffort): string {
  switch (effort) {
    case "low":
      return "Fast responses with lighter reasoning";
    case "medium":
      return "Balances speed and reasoning depth";
    case "high":
      return "Greater reasoning depth for complex tasks";
    case "max":
      return "Maximum reasoning depth for the hardest tasks";
  }
}
