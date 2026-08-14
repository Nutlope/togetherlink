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
 * Pricing and limits sources:
 *  - GLM-5.2: https://docs.together.ai/docs/glm-5.2-quickstart ($1.40/$0.26/$4.40),
 *    https://docs.together.ai/docs/serverless/models (context 512000), and the
 *    models.dev PR github.com/anomalyco/models.dev/pull/2663 (output 164000).
 *  - Kimi K3 and vision models use Together's published model pricing and
 *    capabilities.
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

export type ModelReasoningEffort = "low" | "medium" | "high" | "max";

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
  /** Provider-supported reasoning effort values, when the set is model-specific. */
  reasoningEfforts?: readonly ModelReasoningEffort[];
  /** Default effort advertised to coding harnesses. Must be in reasoningEfforts. */
  defaultReasoningEffort?: ModelReasoningEffort;
  /** Accepts a temperature setting. */
  temperature: boolean;
  /** Supports tool/function calling. */
  tool_call: boolean;
  /** Optional Codex history-compaction threshold from provider-specific model metadata. */
  codexAutoCompactTokenLimit?: number;
  /** Optional first-run message shown when Codex makes this model newly available. */
  codexAvailabilityNuxMessage?: string;
  modalities: ModelModalities;
};

const TOKENS_PER_MILLION = 1_000_000;

/** Convert a per-1M-token price to a per-token price. */
export function costPerToken(costPerMillion: number): number {
  return costPerMillion / TOKENS_PER_MILLION;
}

/**
 * Kimi K3 — Moonshot's 2.8T flagship and the shared coding default. Together's
 * authenticated catalog reports a 1M context window and $3/$15 pricing with
 * $0.30 cached input. Together serves the base model's 1,048,576-token context
 * with a separate 131,072-token output ceiling.
 */
export const KIMI_K3: ModelDefinition = {
  id: "moonshotai/Kimi-K3",
  name: "Kimi K3",
  anthropicAlias: "together-kimi-k3",
  cost: { input: 3, output: 15, cache_read: 0.3 },
  limit: { context: 1_048_576, output: 131_072 },
  attachment: true,
  reasoning: true,
  reasoningEfforts: ["low", "high", "max"],
  defaultReasoningEffort: "high",
  temperature: true,
  tool_call: true,
  codexAutoCompactTokenLimit: 900_000,
  codexAvailabilityNuxMessage:
    "Kimi K3 is now available through TogetherLink. Moonshot AI's flagship model brings advanced reasoning, vision support, and a 1M-token context window to Codex.",
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * GLM-5.2 — Zhipu AI's flagship MoE and the previous coding default.
 * Text-only: image blocks must be routed elsewhere (the Claude proxy
 * intercepts them; OpenCode uses the `@vision` subagent).
 */
export const GLM_5_2: ModelDefinition = {
  id: "zai-org/GLM-5.2",
  name: "GLM 5.2",
  anthropicAlias: "together-glm-5-2",
  cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
  limit: { context: 512_000, output: 164_000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  codexAutoCompactTokenLimit: 460_000,
  modalities: { input: ["text"], output: ["text"] },
};

/**
 * One default shared by every TogetherLink harness.
 *
 * Keep this as a model object rather than duplicating ids in Claude, Codex,
 * OpenCode, Grok, Pi, and ChatGPT Desktop. SELECTABLE_MODELS is built with this
 * entry first so harness model menus and no-argument resolution agree.
 *
 */
export const DEFAULT_MODEL: ModelDefinition = KIMI_K3;

/**
 * Kimi K2.6 — Moonshot's reasoning + vision model. Vision-capable,
 * so it can serve as a vision primary (images reach it directly, no subagent).
 * Pricing/context from Together changelog (June 2026); output limit per
 * models.dev. Kimi K3 is pinned to OpenCode's `@vision` subagent; K2.6 remains
 * selectable as a primary.
 */
export const KIMI_K2_6: ModelDefinition = {
  id: "moonshotai/Kimi-K2.6",
  name: "Kimi K2.6",
  anthropicAlias: null,
  cost: { input: 1.2, output: 4.5, cache_read: 0.2 },
  limit: { context: 262_144, output: 131_000 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  codexAutoCompactTokenLimit: 235_000,
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * MiniMax M3 — newest MiniMax, vision-capable, 512K context, the cheapest
 * vision primary. Pricing from Together changelog (June 2026); output limit
 * (128K) per models.dev.
 */
export const MINIMAX_M3: ModelDefinition = {
  id: "MiniMaxAI/MiniMax-M3",
  name: "MiniMax M3",
  anthropicAlias: null,
  cost: { input: 0.3, output: 1.2, cache_read: 0.06 },
  limit: { context: 524_288, output: 128_000 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  codexAutoCompactTokenLimit: 470_000,
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * Qwen3.7-Max — strongest current Qwen (top tier per Together changelog,
 * June 2026). Vision-capable, 1M context. Output limit (65536) per models.dev.
 * No Together cached-input tier published (cache_read left 0).
 */
export const QWEN_3_7_MAX: ModelDefinition = {
  id: "Qwen/Qwen3.7-Max",
  name: "Qwen 3.7 Max",
  anthropicAlias: null,
  cost: { input: 2.5, output: 3.75, cache_read: 0.125 },
  limit: { context: 1_000_000, output: 65_536 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  codexAutoCompactTokenLimit: 880_000,
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * Capabilities string Claude Code reads from ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES.
 * Mirrors what GLM-5.2 supports on Together: adjustable reasoning effort
 * (incl. xhigh/max), thinking, adaptive thinking, and interleaved thinking.
 */
export const GLM_5_2_ANTHROPIC_CAPABILITIES =
  "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking";

/** Claude Code capabilities verified for Kimi K3 on Together. */
export const KIMI_K3_ANTHROPIC_CAPABILITIES = "effort,max_effort,thinking,interleaved_thinking";

/**
 * Qwen3.5 9B — small, cheap, vision-capable fallback for image description.
 */
export const QWEN_3_5_9B: ModelDefinition = {
  id: "Qwen/Qwen3.5-9B",
  name: "Qwen3.5 9B",
  anthropicAlias: null,
  cost: { input: 0.17, output: 0.25, cache_read: 0 },
  limit: { context: 262_144, output: 32_768 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text", "image"], output: ["text"] },
};

/**
 * Curated vision models for image description, ordered primary-first. The
 * Claude proxy iterates this list with automatic failover; OpenCode wires only
 * the primary (VISION_MODELS[0]) into its `@vision` subagent since subagents
 * take a single model. Reasoning is always disabled on these calls
 * (perception, not reasoning) — handled by callers, not encoded here.
 */
export const VISION_MODELS: readonly ModelDefinition[] = [KIMI_K3, QWEN_3_5_9B];

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
 * Curated current-flagship Together models surfaced in OpenCode's `/models`.
 * Together's full serverless catalog is hidden via the provider `whitelist`
 * (opencode PR #3416); only these ids appear. Each `name` carries a short tip
 * because OpenCode has no per-model `description` field — the display name is
 * the only place a user-facing hint can live. Order = the picker order.
 *
 * Sources: Together changelog (ids/pricing/context, June 2026) +
 * models.dev (output limits). See per-model doc comments for specifics.
 */
const CURATED_MODELS: readonly ModelDefinition[] = [
  KIMI_K3,
  GLM_5_2,
  KIMI_K2_6,
  MINIMAX_M3,
  QWEN_3_7_MAX,
];

export const SELECTABLE_MODELS: readonly ModelDefinition[] = [
  DEFAULT_MODEL,
  ...CURATED_MODELS.filter((model) => model.id !== DEFAULT_MODEL.id),
];

/**
 * Whether a model accepts image input (vision-capable). Used to pick the right
 * OpenCode build-agent system prompt: vision primaries receive images directly,
 * text-only primaries must route to the `@vision` subagent.
 */
export function isVisionModel(model: ModelDefinition): boolean {
  return model.attachment && model.modalities.input.includes("image");
}

/**
 * Find a model definition by its Together id across the curated + vision lists.
 * Returns undefined if not found.
 */
export function findModelById(id: string): ModelDefinition | undefined {
  const all = [...SELECTABLE_MODELS, ...VISION_MODELS];
  return all.find((model) => model.id === id);
}

/**
 * Resolve a model from a list by trying each candidate key against `value`,
 * falling back to the model whose id is `defaultId` (or the first in the list)
 * when no value is given. Returns undefined only when a value is given but no
 * model matches — the caller decides whether that is an error. Pure: no I/O,
 * no throwing; the per-harness "Unsupported <harness> model" error is a cli
 * policy that lives in the thin wrappers, not here.
 */
export function resolveModelByKeys(
  list: readonly ModelDefinition[],
  value: string | undefined,
  keys: ReadonlyArray<(model: ModelDefinition) => string | null | undefined>,
  defaultId: string,
): ModelDefinition | undefined {
  const defaultModel = list.find((model) => model.id === defaultId) ?? list[0];
  if (!value) {
    return defaultModel;
  }
  return list.find((model) => keys.some((key) => key(model) === value));
}

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
