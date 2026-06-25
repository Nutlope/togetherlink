import { type ModelDefinition } from "@togetherlink/models";
import { CODEX_SUPPORTED_MODELS } from "./defaults.js";

const CODEX_BASE_INSTRUCTIONS =
  "You are Codex, a coding agent. You and the user share one workspace, and your job is to help them complete their coding task accurately and efficiently.";

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

export function codexModelCatalog(): { models: Array<Record<string, unknown>> } {
  return { models: CODEX_SUPPORTED_MODELS.map(toCodexModelCatalogEntry) };
}

export function codexModelCatalogJson(): string {
  return JSON.stringify(codexModelCatalog());
}

export function toCodexModelCatalogEntry(model: { id: string; definition: ModelDefinition }): Record<string, unknown> {
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
    additional_speed_tiers: [],
    service_tiers: [],
    default_service_tier: null,
    availability_nux: null,
    upgrade: null,
    base_instructions: CODEX_BASE_INSTRUCTIONS,
    model_messages: CODEX_MODEL_MESSAGES,
    supports_personality: true,
    supports_reasoning_summaries: model.definition.reasoning,
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
