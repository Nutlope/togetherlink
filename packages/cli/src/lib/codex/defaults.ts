import {
  DEFAULT_MODEL,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";

export const CODEX_DEFAULT_MODEL = DEFAULT_MODEL.id;
export const CODEX_PROVIDER_ID = "togetherlink";
export const CODEX_AUTH_ENV = "TOGETHERLINK_CODEX_AUTH_TOKEN";

export type CodexModelSelection = {
  id: string;
  definition: ModelDefinition;
  routingPreset?: "auto";
};

export const CODEX_SUPPORTED_MODELS: readonly CodexModelSelection[] = SELECTABLE_MODELS.map(
  (definition) => ({
    id: definition.id,
    definition,
  }),
);

export const CODEX_ROUTABLE_MODELS: readonly CodexModelSelection[] = [
  ...CODEX_SUPPORTED_MODELS,
  {
    id: "auto",
    definition: { ...DEFAULT_MODEL, id: "auto", name: "Auto", anthropicAlias: "auto" },
    routingPreset: "auto",
  },
];

export function resolveCodexModel(value: string | undefined): CodexModelSelection {
  if (CODEX_ROUTABLE_MODELS.length === 0) {
    throw new Error("No Codex models are configured.");
  }
  const routed = CODEX_ROUTABLE_MODELS.find((model) => model.routingPreset && model.id === value);
  if (routed) return routed;
  const found = resolveModelByKeys(
    CODEX_SUPPORTED_MODELS.map((model) => model.definition),
    value,
    [(model) => model.id],
    CODEX_DEFAULT_MODEL,
  );
  if (!found) {
    const expected = CODEX_ROUTABLE_MODELS.map((model) => model.id).join(", ");
    throw new Error(`Unsupported Codex model "${value}". Expected one of: ${expected}.`);
  }
  return { id: found.id, definition: found };
}
