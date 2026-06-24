import {
  GLM_5_2,
  GLM_5_2_ANTHROPIC_CAPABILITIES,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";

export const CLAUDE_LOCAL_PROXY_HOST = "127.0.0.1";
// ANTHROPIC_MODEL alias Claude Code sees for GLM-5.2 through the proxy.
export const CLAUDE_DEFAULT_MODEL = GLM_5_2.anthropicAlias ?? "together-glm-5-2";
export const CLAUDE_DEFAULT_MODEL_NAME = GLM_5_2.name;
export const CLAUDE_DEFAULT_TOGETHER_MODEL = GLM_5_2.id;
export const CLAUDE_MODEL_CAPABILITIES = GLM_5_2_ANTHROPIC_CAPABILITIES;

export type ClaudeModelSelection = {
  alias: string;
  definition: ModelDefinition;
};

/**
 * Claude-routable models = the curated flagships that carry an Anthropic alias
 * (only alias-bearing models can be selected as a Claude Code backend). Derived
 * from the shared manifest so a new alias-bearing model appears here without a
 * code edit.
 */
export const CLAUDE_SUPPORTED_MODELS: readonly ClaudeModelSelection[] = SELECTABLE_MODELS.filter(
  (model) => model.anthropicAlias !== null,
).map((definition) => ({
  alias: definition.anthropicAlias ?? definition.id,
  definition,
}));

export function resolveClaudeModel(value: string | undefined): ClaudeModelSelection {
  if (CLAUDE_SUPPORTED_MODELS.length === 0) {
    throw new Error("No Claude models are configured.");
  }
  const found = resolveModelByKeys(
    CLAUDE_SUPPORTED_MODELS.map((model) => model.definition),
    value,
    [(model) => model.anthropicAlias, (model) => model.id],
    GLM_5_2.id,
  );
  if (!found) {
    const expected = CLAUDE_SUPPORTED_MODELS.map(
      (model) => `${model.alias} (${model.definition.id})`,
    ).join(", ");
    throw new Error(`Unsupported Claude model "${value}". Expected one of: ${expected}.`);
  }
  return { alias: found.anthropicAlias ?? found.id, definition: found };
}
