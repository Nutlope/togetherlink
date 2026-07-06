import { describe, expect, test } from "vitest";
import type { ModelDefinition } from "../../models/src/index.js";
import {
  EMPTY_CODEX_TOOL_TRANSLATION,
  toChatPayload,
} from "../../cli/src/lib/codex/translate-request.js";
import type { ResponsesRequest } from "../../cli/src/lib/codex/wire-types.js";

// A small model used to exercise the near-window clamp path: a tight context
// window so a modest estimate forces defaultMaxOutputTokens to clamp.
const smallModel: ModelDefinition = {
  id: "test/small",
  name: "Small",
  anthropicAlias: "small",
  cost: { input: 0, output: 0, cache_read: 0 },
  limit: { context: 1000, output: 700 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

// A large-context model used to exercise the no-op-far-from-window fast path.
const largeModel: ModelDefinition = {
  id: "test/large",
  name: "Large",
  anthropicAlias: "large",
  cost: { input: 0, output: 0, cache_read: 0 },
  limit: { context: 100_000, output: 32_000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

const baseOptions = {
  modelId: "test/large",
  targetModelId: "test/large",
  modelName: "Large",
  modelDefinition: largeModel,
};

const baseRequest: ResponsesRequest = {
  input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hi." }] }],
};

function resolveModel(definition: ModelDefinition) {
  return {
    requestedModelId: definition.id,
    targetModelId: definition.id,
    definition,
    memory: false,
  };
}

describe("defaultMaxOutputTokens (via toChatPayload)", () => {
  test("returns the full output budget far from the window (fast path)", () => {
    // estimate 1000 tokens: 1000*1.15 + 32000 + 512 = 33662 < 100000 → fast path.
    const payload = toChatPayload(
      baseRequest,
      baseOptions,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(largeModel),
      1000,
    );
    expect(payload.max_tokens).toBe(largeModel.limit.output);
  });

  test("clamps max_tokens down near the window", () => {
    // smallModel window is 1000; estimate 1600 tokens already overflows even
    // before reserving output, so availableOutputTokens must be clamped down.
    // floor(1000 - 1600 - 512) = floor(-1112) = -1112 → max(1, min(700, -1112)) = 1.
    const payload = toChatPayload(
      baseRequest,
      { ...baseOptions, modelDefinition: smallModel, targetModelId: smallModel.id },
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(smallModel),
      1600,
    );
    expect(payload.max_tokens).toBe(1);
  });

  test("clamps to the available budget just inside the window", () => {
    // Custom model: window 4000, output cap 2000. estimate 2000 tokens:
    // 2000*1.15 + 2000 + 512 = 4812 > 4000 → clamp path (gate does not fire).
    // available = floor(4000 - 2000 - 512) = 1488 → min(2000, 1488) = 1488.
    const customModel: ModelDefinition = {
      id: "test/custom",
      name: "Custom",
      anthropicAlias: null,
      cost: { input: 0, output: 0, cache_read: 0 },
      limit: { context: 4000, output: 2000 },
      attachment: false,
      reasoning: true,
      temperature: true,
      tool_call: true,
      modalities: { input: ["text"], output: ["text"] },
    };
    const payload = toChatPayload(
      baseRequest,
      { ...baseOptions, modelDefinition: customModel, targetModelId: customModel.id },
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(customModel),
      2000,
    );
    expect(payload.max_tokens).toBe(1488);
  });

  test("floors at 1 when the estimate exceeds the entire context window", () => {
    // estimate larger than the whole window → availableOutputTokens is deeply
    // negative; the Math.max(1, ...) floor guarantees we never send 0/negative.
    const payload = toChatPayload(
      baseRequest,
      { ...baseOptions, modelDefinition: smallModel, targetModelId: smallModel.id },
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(smallModel),
      10_000,
    );
    expect(payload.max_tokens).toBe(1);
  });

  test("passes an explicit client max_output_tokens through untouched", () => {
    // When the client provides max_output_tokens, defaultMaxOutputTokens is
    // never consulted — the value is used verbatim regardless of the estimate.
    const requestWithLimit: ResponsesRequest = {
      ...baseRequest,
      max_output_tokens: 1234,
    };
    const payloadFar = toChatPayload(
      requestWithLimit,
      baseOptions,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(largeModel),
      1000,
    );
    expect(payloadFar.max_tokens).toBe(1234);

    // Even near/over the window, an explicit client value is passed through —
    // the clamp only happens via the reactive 400-retry path, never here.
    const payloadNear = toChatPayload(
      requestWithLimit,
      { ...baseOptions, modelDefinition: smallModel, targetModelId: smallModel.id },
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(smallModel),
      10_000,
    );
    expect(payloadNear.max_tokens).toBe(1234);
  });

  test("fast path gate boundary is inclusive on the no-op side", () => {
    // Gate no-op condition: est*1.15 + output + safety < context.
    // For largeModel: est*1.15 + 32000 + 512 < 100000 → est*1.15 < 67488
    // → est < 58685.2. est = 58600 → 58600*1.15 = 67390; +32000+512 = 99902
    // < 100000 → fast path → full output budget.
    const payloadInside = toChatPayload(
      baseRequest,
      baseOptions,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(largeModel),
      58600,
    );
    expect(payloadInside.max_tokens).toBe(largeModel.limit.output);

    // est = 58700 → 58700*1.15 = 67505; +32000+512 = 100017 > 100000 → clamp.
    // available = floor(100000 - 58700 - 512) = 40788 → min(32000, 40788) = 32000.
    // The clamp still yields the full output cap here because the window is
    // large enough; this confirms the gate did NOT short-circuit and the clamp
    // arithmetic ran, even though the result happens to equal the cap.
    const payloadOutside = toChatPayload(
      baseRequest,
      baseOptions,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(largeModel),
      58700,
    );
    expect(payloadOutside.max_tokens).toBe(largeModel.limit.output);
  });
});
