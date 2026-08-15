import {
  DEFAULT_MODEL,
  GLM_5_2,
  GLM_5_2_ANTHROPIC_CAPABILITIES,
  KIMI_K3,
  KIMI_K3_ANTHROPIC_CAPABILITIES,
  QWEN_3_5_9B,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";

export const CLAUDE_LOCAL_PROXY_HOST = "127.0.0.1";
export function claudeModelCapabilities(model: ModelDefinition): string | undefined {
  if (model.id === GLM_5_2.id) {
    return GLM_5_2_ANTHROPIC_CAPABILITIES;
  }
  if (model.id === KIMI_K3.id) {
    return KIMI_K3_ANTHROPIC_CAPABILITIES;
  }
  return undefined;
}

export type ClaudeModelSelection = {
  alias: string;
  definition: ModelDefinition;
};

export const CLAUDE_HAIKU_MODEL = QWEN_3_5_9B;
export const CLAUDE_HAIKU_MODEL_SELECTION: ClaudeModelSelection = {
  alias: CLAUDE_HAIKU_MODEL.anthropicAlias ?? CLAUDE_HAIKU_MODEL.id,
  definition: CLAUDE_HAIKU_MODEL,
};

/**
 * Claude-routable models = every curated flagship plus the lightweight
 * Haiku-tier backend Claude Code uses for built-in exploration subagents.
 * Models without a friendly Anthropic alias use their Together id directly.
 */
const selectableClaudeModels = SELECTABLE_MODELS.map((definition) => ({
  alias: definition.anthropicAlias ?? definition.id,
  definition,
}));

export const CLAUDE_SUPPORTED_MODELS: readonly ClaudeModelSelection[] = [
  ...selectableClaudeModels,
  ...(selectableClaudeModels.some(
    (model) => model.definition.id === CLAUDE_HAIKU_MODEL_SELECTION.definition.id,
  )
    ? []
    : [CLAUDE_HAIKU_MODEL_SELECTION]),
];

export function resolveClaudeModel(value: string | undefined): ClaudeModelSelection {
  if (CLAUDE_SUPPORTED_MODELS.length === 0) {
    throw new Error("No Claude models are configured.");
  }
  const found = resolveModelByKeys(
    CLAUDE_SUPPORTED_MODELS.map((model) => model.definition),
    value,
    [(model) => model.anthropicAlias, (model) => model.id],
    DEFAULT_MODEL.id,
  );
  if (!found) {
    const expected = CLAUDE_SUPPORTED_MODELS.map(
      (model) => `${model.alias} (${model.definition.id})`,
    ).join(", ");
    throw new Error(
      `Model "${value}" is not in TogetherLink's curated model catalog. Curated models: ${expected}. Explicit custom Together chat ids must be validated by the top-level --model launcher path.`,
    );
  }
  return { alias: found.anthropicAlias ?? found.id, definition: found };
}
