import { GLM_5_2, SELECTABLE_MODELS, type ModelDefinition } from "@togetherlink/models";

export const CODEX_DEFAULT_MODEL = GLM_5_2.id;
export const CODEX_DEFAULT_MODEL_NAME = GLM_5_2.name;
export const CODEX_PROVIDER_ID = "togetherlink";
export const CODEX_AUTH_ENV = "TOGETHERLINK_CODEX_AUTH_TOKEN";

export type CodexModelSelection = {
  id: string;
  definition: ModelDefinition;
};

export const CODEX_SUPPORTED_MODELS: readonly CodexModelSelection[] = SELECTABLE_MODELS.map((definition) => ({
  id: definition.id,
  definition,
}));

export function resolveCodexModel(value: string | undefined): CodexModelSelection {
  const defaultModel = CODEX_SUPPORTED_MODELS.find((model) => model.id === CODEX_DEFAULT_MODEL) ?? CODEX_SUPPORTED_MODELS[0];
  if (!defaultModel) {
    throw new Error("No Codex models are configured.");
  }
  if (!value) {
    return defaultModel;
  }
  const found = CODEX_SUPPORTED_MODELS.find((model) => model.id === value);
  if (!found) {
    const expected = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(", ");
    throw new Error(`Unsupported Codex model "${value}". Expected one of: ${expected}.`);
  }
  return found;
}
