import { describe, expect, test } from "vitest";
import { DEEPSEEK_V4_FLASH } from "@togetherlink/models";
import { CLAUDE_SUPPORTED_MODELS, resolveClaudeModel } from "../../cli/src/lib/claude/defaults.js";
import { codexModelCatalog } from "../../cli/src/lib/codex/catalog.js";
import { resolveCodexModel } from "../../cli/src/lib/codex/defaults.js";
import { buildDeepseekPatch } from "../../cli/src/lib/deepseek/core.js";
import { buildGrokModelCatalog } from "../../cli/src/lib/grok/core.js";
import { buildPiModelsJson } from "../../cli/src/lib/harnesses/pi.js";
import { buildOpencodeConfigJson } from "../../cli/src/lib/opencode/core.js";
import { buildPrimeProviderConfig } from "../../cli/src/lib/prime/core.js";

const MODEL_ID = DEEPSEEK_V4_FLASH.id;

describe("DeepSeek V4 Flash curated model flow", () => {
  test("resolves the exact id through the proxied Claude and Codex catalogs", () => {
    expect(resolveClaudeModel(MODEL_ID).definition).toBe(DEEPSEEK_V4_FLASH);
    expect(resolveCodexModel(MODEL_ID).definition).toBe(DEEPSEEK_V4_FLASH);
    expect(CLAUDE_SUPPORTED_MODELS.map((model) => model.definition.id)).toContain(MODEL_ID);
    const codexModels = codexModelCatalog().models;
    expect(codexModels).toContainEqual(
      expect.objectContaining({
        slug: MODEL_ID,
        context_window: 1_048_576,
        input_modalities: ["text"],
      }),
    );
    expect(codexModels.at(-1)?.slug).toBe(MODEL_ID);
  });

  test("appears in every generated direct-harness model catalog", () => {
    const selection = resolveCodexModel(MODEL_ID);
    const deepseekModels = buildDeepseekPatch(selection)[0].config.providers.togetherlink.models;
    expect(deepseekModels).toContainEqual(
      expect.objectContaining({
        id: MODEL_ID,
        contextWindow: 1_048_576,
        maxTokens: 393_216,
        input: ["text"],
        reasoningEfforts: { low: "low", high: "high", max: "max" },
      }),
    );
    expect(deepseekModels.at(-1)?.id).toBe(MODEL_ID);

    const grokModels = buildGrokModelCatalog().data;
    expect(grokModels).toContainEqual(
      expect.objectContaining({ id: MODEL_ID, context_window: 1_048_576 }),
    );
    expect(grokModels.at(-1)?.id).toBe(MODEL_ID);

    const opencode = buildOpencodeConfigJson({ modelId: MODEL_ID });
    const opencodeProvider = opencode.provider?.togetherai as
      | { models?: Record<string, unknown>; whitelist?: string[] }
      | undefined;
    expect(opencodeProvider?.models?.[MODEL_ID]).toMatchObject({
      name: "DeepSeek V4 Flash 0731",
      attachment: false,
      reasoning: true,
      limit: { context: 1_048_576, output: 393_216 },
    });
    expect(opencodeProvider?.whitelist).toContain(MODEL_ID);
    expect(opencodeProvider?.whitelist?.at(-1)).toBe(MODEL_ID);

    const piConfig = JSON.parse(buildPiModelsJson("test-key")) as {
      providers: { together: { models: Array<{ id: string }> } };
    };
    expect(piConfig.providers.together.models).toContainEqual(
      expect.objectContaining({ id: MODEL_ID }),
    );
    expect(piConfig.providers.together.models.at(-1)?.id).toBe(MODEL_ID);

    const primeModels = buildPrimeProviderConfig().models;
    expect(primeModels).toContainEqual(
      expect.objectContaining({
        id: MODEL_ID,
        contextWindow: 1_048_576,
        maxTokens: 393_216,
        input: ["text"],
      }),
    );
    expect(primeModels.at(-1)?.id).toBe(MODEL_ID);
  });
});
