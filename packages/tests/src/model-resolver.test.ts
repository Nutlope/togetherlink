import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  DEEPSEEK_V4_FLASH,
  GLM_5_2,
  KIMI_K3,
  MINIMAX_M3,
  QWEN_3_5_9B,
  SELECTABLE_MODELS,
  VISION_MODELS,
  VISION_PRIMARY,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";
import {
  CLAUDE_HAIKU_MODEL,
  claudeModelCapabilities,
  resolveClaudeModel,
} from "../../cli/src/lib/claude/defaults.js";
import { togetherReasoningEffort } from "../../cli/src/lib/claude/translate-request.js";
import { CODEX_DEFAULT_MODEL, resolveCodexModel } from "../../cli/src/lib/codex/defaults.js";
import { OPENCODE_DEFAULT_MODEL } from "../../cli/src/lib/opencode/defaults.js";

// Unit tests for the shared model-selection mechanism. The per-harness
// wrappers (resolveClaudeModel / resolveCodexModel) are thin policy over this
// pure helper, and the live gauntlet never exercises `--main`, so this is the
// only place the resolution algorithm is asserted today.

describe("resolveModelByKeys", () => {
  // Claude matches by alias OR id; mirrors the key set in resolveClaudeModel.
  const aliasAndId: ReadonlyArray<(model: ModelDefinition) => string | null | undefined> = [
    (model) => model.anthropicAlias,
    (model) => model.id,
  ];
  const byId: ReadonlyArray<(model: ModelDefinition) => string | null | undefined> = [
    (model) => model.id,
  ];

  it("returns the default model when no value is given", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, aliasAndId, DEFAULT_MODEL.id)?.id).toBe(
      DEFAULT_MODEL.id,
    );
  });

  it("returns the default model when the value is empty", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, "", aliasAndId, DEFAULT_MODEL.id)?.id).toBe(
      DEFAULT_MODEL.id,
    );
  });

  it("matches by id", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, MINIMAX_M3.id, aliasAndId, DEFAULT_MODEL.id)?.id,
    ).toBe(MINIMAX_M3.id);
  });

  it("matches by alias", () => {
    expect(
      resolveModelByKeys(
        SELECTABLE_MODELS,
        GLM_5_2.anthropicAlias ?? undefined,
        aliasAndId,
        DEFAULT_MODEL.id,
      )?.id,
    ).toBe(GLM_5_2.id);
  });

  it("returns undefined when the value matches no model", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, "no/such-model", aliasAndId, DEFAULT_MODEL.id),
    ).toBeUndefined();
  });

  it("falls back to the first list entry when defaultId is not in the list", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, byId, "no/such-id")?.id).toBe(
      SELECTABLE_MODELS[0]?.id,
    );
  });

  it("returns undefined for an empty list", () => {
    expect(resolveModelByKeys([], undefined, byId, DEFAULT_MODEL.id)).toBeUndefined();
  });
});

describe("shared harness default", () => {
  it("exposes DeepSeek V4 Flash with verified Together and DeepSeek metadata", () => {
    expect(SELECTABLE_MODELS).toContain(DEEPSEEK_V4_FLASH);
    expect(DEEPSEEK_V4_FLASH).toMatchObject({
      id: "deepseek-ai/DeepSeek-V4-Flash-0731",
      name: "DeepSeek V4 Flash 0731",
      anthropicAlias: null,
      cost: { input: 0.14, cache_read: 0.03, output: 0.28 },
      limit: { context: 1_048_576, output: 393_216 },
      attachment: false,
      reasoning: true,
      reasoningEfforts: ["low", "high", "max"],
      defaultReasoningEffort: "high",
      temperature: true,
      tool_call: true,
      modalities: { input: ["text"], output: ["text"] },
    });
  });

  it("uses Kimi K3 as the shared coding default", () => {
    expect(DEFAULT_MODEL).toBe(KIMI_K3);
    expect(DEFAULT_MODEL).toMatchObject({
      id: "moonshotai/Kimi-K3",
      anthropicAlias: "together-kimi-k3",
      cost: { input: 3, cache_read: 0.3, output: 15 },
      limit: { context: 1_048_576, output: 131_072 },
      attachment: true,
      reasoning: true,
      reasoningEfforts: ["low", "high", "max"],
      defaultReasoningEffort: "high",
      tool_call: true,
      modalities: { input: ["text", "image"], output: ["text"] },
    });
  });

  it("keeps every no-argument harness resolver on the shared default", () => {
    expect(SELECTABLE_MODELS[0]).toBe(DEFAULT_MODEL);
    expect(CODEX_DEFAULT_MODEL).toBe(DEFAULT_MODEL.id);
    expect(OPENCODE_DEFAULT_MODEL).toBe(DEFAULT_MODEL.id);
    expect(resolveCodexModel(undefined).definition).toBe(DEFAULT_MODEL);
    expect(resolveClaudeModel(undefined).definition).toBe(DEFAULT_MODEL);
  });

  it("advertises Claude custom-model capabilities only when verified per model", () => {
    expect(claudeModelCapabilities(GLM_5_2)).toBeTruthy();
    expect(claudeModelCapabilities(KIMI_K3)).toBe(
      "effort,max_effort,thinking,interleaved_thinking",
    );
    expect(claudeModelCapabilities(MINIMAX_M3)).toBeUndefined();
  });

  it("derives Claude reasoning efforts from shared model metadata", () => {
    const metadataDrivenModel: ModelDefinition = {
      ...KIMI_K3,
      id: "test/metadata-driven-reasoning",
      reasoningEfforts: ["low"],
    };

    expect(togetherReasoningEffort({ effort: "low" }, metadataDrivenModel)).toBe("low");
    expect(togetherReasoningEffort({ effort: "high" }, metadataDrivenModel)).toBeUndefined();
    expect(togetherReasoningEffort({ effort: "xhigh" }, KIMI_K3)).toBe("max");
  });

  it("uses GLM-5.2's current serverless limits without changing its pricing", () => {
    expect(GLM_5_2).toMatchObject({
      cost: { input: 1.4, cache_read: 0.26, output: 4.4 },
      limit: { context: 512_000, output: 164_000 },
      codexAutoCompactTokenLimit: 460_000,
    });
  });
});

describe("vision model migration", () => {
  it("uses Kimi K3 as the primary vision model with a small fallback", () => {
    expect(VISION_PRIMARY).toBe(KIMI_K3);
    expect(VISION_MODELS).toEqual([KIMI_K3, QWEN_3_5_9B]);
    expect(CLAUDE_HAIKU_MODEL).toBe(QWEN_3_5_9B);
  });

  it("does not expose models scheduled for serverless removal", () => {
    const modelIds = SELECTABLE_MODELS.map((model) => model.id);
    expect(modelIds).not.toContain("moonshotai/Kimi-K2.6");
    expect(modelIds).not.toContain("moonshotai/Kimi-K2.7-Code");
    expect(modelIds).not.toContain("deepseek-ai/DeepSeek-V4-Pro");
  });
});
