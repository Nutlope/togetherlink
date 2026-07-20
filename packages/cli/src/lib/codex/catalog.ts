import { type ModelDefinition } from "@togetherlink/models";
import { CODEX_SUPPORTED_MODELS } from "./defaults.js";

const CODEX_BASE_INSTRUCTIONS =
  "You are Codex, a coding agent. You and the user share one workspace, and your job is to help them complete their coding task accurately and efficiently.";

// Safety margin for the Codex ↔ Together tokenizer mismatch.
//
// Codex counts tokens with its own tokenizer, which consistently
// underestimates relative to Together's server-side count: the mismatch is
// ~1.77× for text+tool-schemas and even higher with vision content. With the
// full context window Codex never compacts until Together already rejected
// with context_length_exceeded — by then the SSE stream is dead and the user
// sees "stream disconnected before completion".
//
// We derive three catalog fields from this ratio so Codex compacts and
// truncates *proactively*, before Together's tokenizer rejects:
//   auto_compact_token_limit  = floor(context / RATIO)  ← compaction trigger
//   effective_context_window_percent = round(100 / RATIO) ← fallback %
//   truncation_policy.limit   = floor(context / RATIO)  ← hard truncation
//
// The proxy's reactive input-trim (together-call.ts) remains the backstop
// for edge cases (e.g. vision-heavy payloads with a higher ratio).
const CODEX_TOKENIZER_MISMATCH_RATIO = 1.8;

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
  return {
    models: CODEX_SUPPORTED_MODELS.map((model, index) => toCodexModelCatalogEntry(model, index)),
  };
}

export function codexModelCatalogJson(): string {
  return JSON.stringify(codexModelCatalog());
}

export function toCodexModelCatalogEntry(
  model: { id: string; definition: ModelDefinition },
  priority = 50,
): Record<string, unknown> {
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
      limit: Math.floor(model.definition.limit.context / CODEX_TOKENIZER_MISMATCH_RATIO),
    },
    supports_parallel_tool_calls: model.definition.tool_call,
    supports_image_detail_original: model.definition.attachment,
    context_window: model.definition.limit.context,
    max_context_window: model.definition.limit.context,
    auto_compact_token_limit: Math.floor(
      model.definition.limit.context / CODEX_TOKENIZER_MISMATCH_RATIO,
    ),
    comp_hash: null,
    effective_context_window_percent: Math.round(100 / CODEX_TOKENIZER_MISMATCH_RATIO),
    experimental_supported_tools: [],
    input_modalities: model.definition.modalities.input,
    supports_search_tool: model.definition.tool_call,
    use_responses_lite: false,
  };
}
