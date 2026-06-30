import { describe, expect, it } from "vitest";
import {
  GLM_5_2,
  KIMI_K2_7_CODE,
  SELECTABLE_MODELS,
  resolveModelByKeys,
  type ModelDefinition,
} from "@togetherlink/models";

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
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, aliasAndId, GLM_5_2.id)?.id).toBe(
      GLM_5_2.id,
    );
  });

  it("returns the default model when the value is empty", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, "", aliasAndId, GLM_5_2.id)?.id).toBe(GLM_5_2.id);
  });

  it("matches by id", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, KIMI_K2_7_CODE.id, aliasAndId, GLM_5_2.id)?.id,
    ).toBe(KIMI_K2_7_CODE.id);
  });

  it("matches by alias", () => {
    expect(
      resolveModelByKeys(
        SELECTABLE_MODELS,
        GLM_5_2.anthropicAlias ?? undefined,
        aliasAndId,
        GLM_5_2.id,
      )?.id,
    ).toBe(GLM_5_2.id);
  });

  it("returns undefined when the value matches no model", () => {
    expect(
      resolveModelByKeys(SELECTABLE_MODELS, "no/such-model", aliasAndId, GLM_5_2.id),
    ).toBeUndefined();
  });

  it("falls back to the first list entry when defaultId is not in the list", () => {
    expect(resolveModelByKeys(SELECTABLE_MODELS, undefined, byId, "no/such-id")?.id).toBe(
      SELECTABLE_MODELS[0]?.id,
    );
  });

  it("returns undefined for an empty list", () => {
    expect(resolveModelByKeys([], undefined, byId, GLM_5_2.id)).toBeUndefined();
  });
});
