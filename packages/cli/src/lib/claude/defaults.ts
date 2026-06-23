import {
  GLM_5_2,
  GLM_5_2_ANTHROPIC_CAPABILITIES,
  KIMI_K2_7_CODE,
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

export const CLAUDE_SUPPORTED_MODELS: readonly ClaudeModelSelection[] = [GLM_5_2, KIMI_K2_7_CODE].map(
  (definition) => ({
    alias: definition.anthropicAlias ?? definition.id,
    definition,
  }),
);

export function resolveClaudeModel(value: string | undefined): ClaudeModelSelection {
  const defaultModel = CLAUDE_SUPPORTED_MODELS[0];
  if (!defaultModel) {
    throw new Error("No Claude models are configured.");
  }
  if (!value) {
    return defaultModel;
  }
  const found = CLAUDE_SUPPORTED_MODELS.find(
    (model) => model.alias === value || model.definition.id === value,
  );
  if (!found) {
    const expected = CLAUDE_SUPPORTED_MODELS.map(
      (model) => `${model.alias} (${model.definition.id})`,
    ).join(", ");
    throw new Error(`Unsupported Claude model "${value}". Expected one of: ${expected}.`);
  }
  return found;
}
