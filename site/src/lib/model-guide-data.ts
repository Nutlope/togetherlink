import { DEFAULT_MODEL, SELECTABLE_MODELS, type ModelDefinition } from "@togetherlink/models";

export type ModelGuideEntry = {
  id: string;
  name: string;
  note: string;
};

export const MODEL_GUIDE_ENTRIES: readonly ModelGuideEntry[] = SELECTABLE_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  note: modelGuideNote(model),
}));

function modelGuideNote(model: ModelDefinition): string {
  const traits = [
    model.id === DEFAULT_MODEL.id ? "Default" : undefined,
    model.attachment ? "vision" : "text",
    model.reasoning ? "reasoning" : undefined,
    contextLabel(model.limit.context),
  ];
  return traits.filter(Boolean).join(" · ");
}

function contextLabel(tokens: number): string {
  if (tokens >= 1_000_000) {
    return "1M context";
  }
  return `${Math.round(tokens / 1_000)}K context`;
}
