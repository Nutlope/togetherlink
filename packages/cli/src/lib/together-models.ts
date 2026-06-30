import { TOGETHER_BASE_URL } from "./together-core.js";
import { upstreamFetch } from "./upstream-fetch.js";

export type TogetherModel = {
  id: string;
  displayName: string;
  type: string;
  contextLength: number | null;
  pricing: unknown;
};

type TogetherModelsApiItem = {
  id: string;
  display_name?: string;
  type: string;
  context_length?: number;
  pricing?: unknown;
};

/**
 * Live catalog fetch — used by `model list`/`model select`. Separate from
 * the curated "best defaults" manifest (recommended-models.ts, not yet
 * built), which is what picks a sane default without the user having to
 * browse this full list themselves.
 */
export async function fetchTogetherModels(apiKey: string): Promise<TogetherModel[]> {
  const response = await upstreamFetch(`${TOGETHER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Together API returned ${response.status} fetching /models`);
  }
  const models = (await response.json()) as TogetherModelsApiItem[];
  return models.map((model) => ({
    id: model.id,
    displayName: model.display_name ?? model.id,
    type: model.type,
    contextLength: model.context_length ?? null,
    pricing: model.pricing ?? null,
  }));
}

export function filterChatModels(catalog: TogetherModel[]): TogetherModel[] {
  return catalog.filter((model) => model.type === "chat");
}

export function filterCatalogBySearch(
  catalog: TogetherModel[],
  query: string | undefined,
): TogetherModel[] {
  if (!query) {
    return catalog;
  }
  const needle = query.toLowerCase();
  return catalog.filter(
    (model) =>
      model.id.toLowerCase().includes(needle) || model.displayName.toLowerCase().includes(needle),
  );
}
