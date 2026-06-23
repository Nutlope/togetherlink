/**
 * Single source of truth for the Together models togetherlink routes to:
 * ids, capabilities, modalities, and per-token cost. Both harnesses (Claude
 * Code's local proxy and OpenCode's ephemeral config) import from here so the
 * facts can't drift between them.
 *
 * This is intentionally pure data + tiny helpers — no fetch, no spawning. It
 * is the future home of the remotely-updatable curated manifest referenced in
 * the repo PLAN.md; for now the manifest is static and shipped in-tree.
 *
 * Pricing sources:
 *  - GLM-5.2: https://docs.together.ai/docs/glm-5.2-quickstart ($1.40/$0.26/$4.40)
 *    and the models.dev PR github.com/anomalyco/models.dev/pull/2663
 *    (context 262144, output 164000).
 *  - Vision models: scripts/bench-vision-results.md in the repo
 *    (moonshotai/Kimi-K2.7-Code $0.95/$0.19/$4.00 primary,
 *     Qwen/Qwen3.5-9B $0.17/$0.25 fallback).
 */

export const TOGETHER_BASE_URL = "https://api.together.ai/v1";

export type ModelCost = {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M cached input tokens (Together shared prefix cache). 0 if none. */
  cache_read: number;
};

export type ModelLimit = {
  /** Max input context window in tokens. */
  context: number;
  /** Max output tokens per response. */
  output: number;
};

export type ModelModalities = {
  input: readonly ("text" | "audio" | "image" | "video" | "pdf")[];
  output: readonly ("text" | "audio" | "image" | "video" | "pdf")[];
};

export type ModelDefinition = {
  /** The Together API model id, e.g. "zai-org/GLM-5.2". */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Claude Code's ANTHROPIC_MODEL alias for this model, or null for non-primary. */
  anthropicAlias: string | null;
  cost: ModelCost;
  limit: ModelLimit;
  /** Accepts image attachments (vision). */
  attachment: boolean;
  /** Supports reasoning/thinking tokens. */
  reasoning: boolean;
  /** Accepts a temperature setting. */
  temperature: boolean;
  /** Supports tool/function calling. */
  tool_call: boolean;
  modalities: ModelModalities;
};

const TOKENS_PER_MILLION = 1_000_000;

/** Convert a per-1M-token price to a per-token price. */
export function costPerToken(costPerMillion: number): number {
  return costPerMillion / TOKENS_PER_MILLION;
}

/**
 * GLM-5.2 — Zhipu AI's flagship MoE, the default coding model for both
 * harnesses. Text-only: image blocks must be routed elsewhere (the Claude
 * proxy intercepts them; OpenCode uses the `@vision` subagent).
 */
export const GLM_5_2: ModelDefinition = {
  id: "zai-org/GLM-5.2",
  name: "Together GLM 5.2",
  anthropicAlias: "together-glm-5-2",
  cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
  limit: { context: 262_144, output: 164_000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

/**
 * Capabilities string Claude Code reads from ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES.
 * Mirrors what GLM-5.2 supports on Together: adjustable reasoning effort
 * (incl. xhigh/max), thinking, adaptive thinking, and interleaved thinking.
 */
export const GLM_5_2_ANTHROPIC_CAPABILITIES =
  "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking";

/**
 * Curated vision models for image description, ordered primary-first. The
 * Claude proxy iterates this list with automatic failover; OpenCode wires only
 * the primary (VISION_MODELS[0]) into its `@vision` subagent since subagents
 * take a single model. See scripts/bench-vision-results.md for the selection
 * rationale. Reasoning is always disabled on these calls (perception, not
 * reasoning) — handled by callers, not encoded here.
 */
export const VISION_MODELS: readonly ModelDefinition[] = [
  {
    id: "moonshotai/Kimi-K2.7-Code",
    name: "Kimi K2.7 Code",
    anthropicAlias: null,
    cost: { input: 0.95, output: 4.0, cache_read: 0.19 },
    limit: { context: 131_072, output: 32_768 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  {
    id: "Qwen/Qwen3.5-9B",
    name: "Qwen3.5 9B",
    anthropicAlias: null,
    cost: { input: 0.17, output: 0.25, cache_read: 0 },
    limit: { context: 131_072, output: 32_768 },
    attachment: true,
    reasoning: true,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
  },
];

/** Primary vision model (first in VISION_MODELS). */
export const VISION_PRIMARY: ModelDefinition = VISION_MODELS[0] ?? {
  id: "",
  name: "",
  anthropicAlias: null,
  cost: { input: 0, output: 0, cache_read: 0 },
  limit: { context: 0, output: 0 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * Prompt for the image-description sub-call. Shared by the Claude proxy (which
 * injects it on its own vision fetch) and the OpenCode `@vision` subagent
 * (which uses it as the agent system prompt). Keep it perception-focused and
 * concise so the main model reasons over a tight description.
 */
export const VISION_PROMPT =
  "Describe this image for a coding assistant that cannot see it. " +
  "Be concise but specific: layout, UI elements, colors, any text (quote it " +
  "verbatim), diagrams, charts, or notable details. If it is a screenshot, " +
  "describe the visible UI. Keep it under 150 words.";