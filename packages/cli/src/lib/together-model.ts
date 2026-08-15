import {
  DEFAULT_MODEL,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";
import { HARNESS, type HarnessId } from "./harness.js";

const CATALOG_TIMEOUT_MS = 10_000;
const FALLBACK_CONTEXT_TOKENS = 32_768;
const FALLBACK_OUTPUT_TOKENS = 8_192;

type CatalogPricing = {
  input?: unknown;
  output?: unknown;
  cached_input?: unknown;
};

type CatalogModel = {
  id?: unknown;
  type?: unknown;
  display_name?: unknown;
  context_length?: unknown;
  pricing?: CatalogPricing;
};

export type CatalogModelMetadata = {
  source: "together-catalog";
  pricingKnown: boolean;
};

export type RuntimeModelDefinition = ModelDefinition & {
  catalogMetadata?: CatalogModelMetadata;
};

export type ResolvedTogetherModel = {
  definition: RuntimeModelDefinition;
  custom: boolean;
  warnings: string[];
};

type CustomModelHarnessPolicy = {
  label: string;
  requiresPricing: boolean;
};

/**
 * Every registered harness is intentionally listed here. The registry-wide
 * test fails when a future harness is added without choosing a custom-model
 * policy, so no adapter can silently bypass authenticated catalog validation.
 */
export const CUSTOM_MODEL_HARNESS_POLICY = {
  [HARNESS.CLAUDE]: { label: "Claude Code", requiresPricing: true },
  [HARNESS.CODEX]: { label: "Codex", requiresPricing: true },
  [HARNESS.DEEPSEEK]: { label: "DeepSeek Harness", requiresPricing: false },
  [HARNESS.GROK]: { label: "Grok Build", requiresPricing: false },
  [HARNESS.HERMES]: { label: "Hermes Agent", requiresPricing: false },
  [HARNESS.OPENCODE]: { label: "OpenCode", requiresPricing: false },
  [HARNESS.PI]: { label: "Pi Code", requiresPricing: true },
  [HARNESS.PRIME]: { label: "Prime Agent", requiresPricing: true },
} as const satisfies Record<HarnessId, CustomModelHarnessPolicy>;

export async function resolveTogetherModel({
  requestedModel,
  apiKey,
  baseUrl,
  harness,
  fetchImpl = fetch,
}: {
  requestedModel: string | undefined;
  apiKey: string;
  baseUrl: string;
  harness: HarnessId;
  fetchImpl?: typeof fetch;
}): Promise<ResolvedTogetherModel> {
  const curated = resolveModelByKeys(
    SELECTABLE_MODELS,
    requestedModel,
    [(model) => model.anthropicAlias, (model) => model.id],
    DEFAULT_MODEL.id,
  );
  if (curated) {
    return { definition: curated, custom: false, warnings: [] };
  }

  const exactId = requestedModel?.trim();
  if (!exactId) {
    return { definition: DEFAULT_MODEL, custom: false, warnings: [] };
  }

  const catalog = await fetchTogetherCatalog({ apiKey, baseUrl, fetchImpl, modelId: exactId });
  const entry = catalog.find((candidate) => candidate.id === exactId);
  if (!entry) {
    throw new Error(
      `Model "${exactId}" is not an exact match in Together's authenticated model catalog. Check the provider/model id and letter case; TogetherLink never falls back to a curated model for an explicit --model value.`,
    );
  }
  if (entry.type !== "chat") {
    const actualType = typeof entry.type === "string" ? entry.type : "unknown";
    throw new Error(
      `Model "${exactId}" exists in Together's catalog, but its catalog type is "${actualType}"; --model accepts chat models only.`,
    );
  }

  return customModelFromCatalog(entry, harness);
}

async function fetchTogetherCatalog({
  apiKey,
  baseUrl,
  fetchImpl,
  modelId,
}: {
  apiKey: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  modelId: string;
}): Promise<CatalogModel[]> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Could not validate custom model "${modelId}" against Together's authenticated model catalog: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Could not validate custom model "${modelId}" against Together's authenticated model catalog (HTTP ${response.status}). Check the configured Together API key and try again.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Together's authenticated model catalog returned invalid JSON.");
  }
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : undefined;
  if (!rows) {
    throw new Error("Together's authenticated model catalog returned an unexpected shape.");
  }
  return rows.filter(isRecord) as CatalogModel[];
}

function customModelFromCatalog(entry: CatalogModel, harness: HarnessId): ResolvedTogetherModel {
  const id = String(entry.id);
  const warnings: string[] = [];
  const catalogContext = finitePositive(entry.context_length);
  const context = catalogContext ?? FALLBACK_CONTEXT_TOKENS;
  if (catalogContext === undefined) {
    warnings.push(
      `Together's catalog does not publish a context limit for ${id}; using a ${FALLBACK_CONTEXT_TOKENS.toLocaleString("en-US")}-token conservative context limit.`,
    );
  }

  const output = Math.min(FALLBACK_OUTPUT_TOKENS, context);
  warnings.push(
    `Together's catalog does not publish an output limit for ${id}; using an ${output.toLocaleString("en-US")}-token conservative output limit.`,
  );
  warnings.push(
    `Together's catalog does not publish modality or capability metadata for ${id}; using text-only mode and not advertising vision, reasoning, or tool support in generated metadata.`,
  );

  const input = finiteNonNegative(entry.pricing?.input);
  const outputPrice = finiteNonNegative(entry.pricing?.output);
  const cachedInput = finiteNonNegative(entry.pricing?.cached_input);
  const pricingKnown = input !== undefined && outputPrice !== undefined;
  const policy = CUSTOM_MODEL_HARNESS_POLICY[harness];
  if (!pricingKnown && policy.requiresPricing) {
    throw new Error(
      `${policy.label} cannot safely use this custom model because Together's catalog does not publish complete input/output pricing required for honest cost reporting or harness metadata. Choose a curated model or another custom chat model with catalog pricing.`,
    );
  }
  if (!pricingKnown) {
    warnings.push(
      `Together's catalog does not publish complete pricing for ${id}; this direct harness will report session lifecycle only, not estimated cost.`,
    );
  }
  if (pricingKnown && cachedInput === undefined) {
    warnings.push(
      `Together's catalog does not publish cached-input pricing for ${id}; using the standard input rate so cost reporting does not understate spend.`,
    );
  }

  const displayName =
    typeof entry.display_name === "string" && entry.display_name.trim()
      ? entry.display_name.trim()
      : id;
  const definition: RuntimeModelDefinition = {
    id,
    name: displayName,
    anthropicAlias: null,
    cost: {
      input: input ?? 0,
      output: outputPrice ?? 0,
      cache_read: cachedInput ?? input ?? 0,
    },
    limit: { context, output },
    attachment: false,
    reasoning: false,
    temperature: false,
    tool_call: false,
    modalities: { input: ["text"], output: ["text"] },
    catalogMetadata: { source: "together-catalog", pricingKnown },
  };
  return { definition, custom: true, warnings };
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
