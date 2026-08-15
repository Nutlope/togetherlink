import { describe, expect, test, vi } from "vitest";
import { buildClaudeEnv } from "../../cli/src/lib/claude/core.js";
import { codexModelCatalog } from "../../cli/src/lib/codex/catalog.js";
import { buildDeepseekPatch } from "../../cli/src/lib/deepseek/core.js";
import { buildGrokModelCatalog } from "../../cli/src/lib/grok/core.js";
import { HARNESS } from "../../cli/src/lib/harness.js";
import { buildPiModelsJson } from "../../cli/src/lib/harnesses/pi.js";
import { buildOpencodeConfigJson } from "../../cli/src/lib/opencode/core.js";
import { buildPrimeProviderConfig } from "../../cli/src/lib/prime/core.js";
import { resolveTogetherModel } from "../../cli/src/lib/together-model.js";

const CUSTOM_ID = "future-org/Future-Chat-1";
const BASE_URL = "https://api.together.ai/v1";

async function customModel() {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: CUSTOM_ID,
          type: "chat",
          display_name: "Future Chat 1",
          context_length: 131_072,
          pricing: { input: 0.2, output: 0.8, cached_input: 0.05 },
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  return (
    await resolveTogetherModel({
      requestedModel: CUSTOM_ID,
      apiKey: "runtime-credential",
      baseUrl: BASE_URL,
      harness: HARNESS.CODEX,
      fetchImpl,
    })
  ).definition;
}

describe("validated custom model harness metadata", () => {
  test("threads the exact model through proxied Codex and Claude catalogs", async () => {
    const definition = await customModel();
    const selection = { id: definition.id, definition };
    const entry = codexModelCatalog([selection]).models.find(
      (candidate) => candidate.slug === CUSTOM_ID,
    );
    expect(entry).toMatchObject({
      slug: CUSTOM_ID,
      display_name: "Future Chat 1",
      context_window: 131_072,
      supports_parallel_tool_calls: false,
      input_modalities: ["text"],
    });

    const env = buildClaudeEnv({
      apiKey: "runtime-credential",
      modelId: CUSTOM_ID,
      modelDefinition: definition,
      modelName: definition.name,
      proxyUrl: "http://127.0.0.1:4242",
      authToken: "local-session-token",
    });
    expect(env.ANTHROPIC_MODEL).toBe(CUSTOM_ID);
    expect(env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe(CUSTOM_ID);
    expect(env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES).toBeUndefined();
  });

  test("adds the selected model only to per-launch spawned harness catalogs", async () => {
    const definition = await customModel();
    const selection = { id: definition.id, definition };

    const opencode = buildOpencodeConfigJson({
      modelId: CUSTOM_ID,
      modelDefinition: definition,
      baseUrl: BASE_URL,
    });
    const opencodeProvider = opencode.provider?.togetherai as
      | { models?: Record<string, unknown>; whitelist?: string[] }
      | undefined;
    expect(opencode.model).toBe(`togetherai/${CUSTOM_ID}`);
    expect(opencodeProvider?.models?.[CUSTOM_ID]).toMatchObject({
      name: "Future Chat 1",
      tool_call: false,
      limit: { context: 131_072, output: 8_192 },
    });
    expect(opencodeProvider?.whitelist).toContain(CUSTOM_ID);

    expect(buildGrokModelCatalog(BASE_URL, [definition]).data).toContainEqual(
      expect.objectContaining({ id: CUSTOM_ID, context_window: 131_072 }),
    );
    const deepseekModels = buildDeepseekPatch(selection, BASE_URL, undefined, [selection])[0].config
      .providers.togetherlink.models;
    expect(deepseekModels).toEqual([
      expect.objectContaining({ id: CUSTOM_ID, contextWindow: 131_072, maxTokens: 8_192 }),
    ]);

    const piConfig = JSON.parse(buildPiModelsJson(BASE_URL, [selection])) as {
      providers: { together: { apiKey?: string; models: Array<{ id: string }> } };
    };
    expect(piConfig.providers.together.models).toContainEqual(
      expect.objectContaining({ id: CUSTOM_ID }),
    );
    expect(piConfig.providers.together.apiKey).toBeUndefined();

    expect(buildPrimeProviderConfig(BASE_URL, [selection]).models).toContainEqual(
      expect.objectContaining({ id: CUSTOM_ID, contextWindow: 131_072, maxTokens: 8_192 }),
    );
  });
});
