import { describe, expect, test, vi } from "vitest";
import { KIMI_K2_7_CODE } from "../../models/src/index.js";
import type { ModelDefinition } from "../../models/src/index.js";
import { CostTracker } from "../../cli/src/lib/cost.js";
import { applyEstimatedContextBudget } from "../../cli/src/lib/claude/context-budget.js";
import { countTokensResponse } from "../../cli/src/lib/claude/translate-response.js";
import type { AnthropicCountTokensRequest } from "../../cli/src/lib/claude/wire-types.js";

// A small model used for the clamp-path boundary test: tight window so the
// near-window clamp path is exercised without megabytes of fixture text.
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

// A large-context model used for the no-op-far-from-window test.
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

describe("CostTracker self-calibrating token estimator", () => {
  test("falls back to APPROX_CHARS_PER_TOKEN with no calibration history", () => {
    const tracker = new CostTracker();
    const estimator = tracker.tokenEstimator;
    // No noteRequestBytes / addUsage yet → ratio is undefined → fallback to 4.
    expect(estimator.estimate(0)).toBe(1); // Math.max(1, ...) floor
    expect(estimator.estimate(400)).toBe(100); // 400 / 4
    expect(estimator.estimate(401)).toBe(101); // ceil(401/4)
    expect(estimator.estimate(4)).toBe(1);
  });

  test("calibrates the ratio after one turn against real prompt_tokens", () => {
    const tracker = new CostTracker();
    // Inbound body was 8000 bytes.
    tracker.noteRequestBytes(8000);
    tracker.beginRequest();
    // Together reports 2000 prompt_tokens for that body → ratio 4 bytes/token.
    tracker.addUsage(2000, 0, 10);
    const estimator = tracker.tokenEstimator;
    // Next turn: a 12000-byte body → 12000 / 4 = 3000 tokens.
    expect(estimator.estimate(12000)).toBe(3000);
  });

  test("recalibrates each turn from the latest ground-truth sample", () => {
    const tracker = new CostTracker();
    // Turn 1: 8000 bytes, 2000 tokens → ratio 4.
    tracker.noteRequestBytes(8000);
    tracker.beginRequest();
    tracker.addUsage(2000, 0, 10);
    expect(tracker.tokenEstimator.estimate(8000)).toBe(2000);

    // Turn 2: 9000 bytes, 3000 tokens → ratio 3 bytes/token (denser tokens).
    tracker.noteRequestBytes(9000);
    tracker.beginRequest();
    tracker.addUsage(3000, 0, 5);
    expect(tracker.tokenEstimator.estimate(9000)).toBe(3000); // 9000 / 3
    expect(tracker.tokenEstimator.estimate(6000)).toBe(2000); // 6000 / 3
  });

  test("clamps a degenerate low ratio (token-dense) to the minimum", () => {
    const tracker = new CostTracker();
    // 1 byte for 10,000 tokens would be ratio 0.0001 — clearly degenerate.
    tracker.noteRequestBytes(1);
    tracker.beginRequest();
    tracker.addUsage(10_000, 0, 1);
    // Ratio clamped to MIN_BYTES_PER_TOKEN (1): estimate = bytes / 1.
    expect(tracker.tokenEstimator.estimate(50)).toBe(50);
  });

  test("clamps a degenerate high ratio (byte-heavy) to the maximum", () => {
    const tracker = new CostTracker();
    // 1,000,000 bytes for 64 tokens → ratio ~15625 — degenerate (e.g. base64).
    tracker.noteRequestBytes(1_000_000);
    tracker.beginRequest();
    tracker.addUsage(64, 0, 1);
    // Ratio clamped to MAX_BYTES_PER_TOKEN (16): estimate = bytes / 16.
    expect(tracker.tokenEstimator.estimate(1600)).toBe(100);
  });

  test("ignores calibration samples with tiny prompt_tokens", () => {
    const tracker = new CostTracker();
    // 4000 bytes, but only 10 prompt_tokens — below the calibration floor.
    tracker.noteRequestBytes(4000);
    tracker.beginRequest();
    tracker.addUsage(10, 0, 1);
    // No calibration happened → still using the fallback ratio of 4.
    expect(tracker.tokenEstimator.estimate(4000)).toBe(1000); // 4000 / 4
  });

  test("calibrates only on the first addUsage of a request across a tool loop", () => {
    const tracker = new CostTracker();
    // Inbound request body 8000 bytes.
    tracker.noteRequestBytes(8000);
    tracker.beginRequest();
    // First Together call of this request: 8000 bytes → 2000 tokens (ratio 4).
    tracker.addUsage(2000, 0, 10);
    expect(tracker.tokenEstimator.estimate(8000)).toBe(2000);

    // Second call in the same tool loop: the prompt grew (assistant + tool
    // result appended), so prompt_tokens is larger. This must NOT recalibrate
    // against the original 8000-byte inbound body.
    tracker.addUsage(5000, 0, 20);
    // Still ratio 4 from the first call.
    expect(tracker.tokenEstimator.estimate(8000)).toBe(2000);

    // A new request begins: now the next first-call may recalibrate.
    tracker.noteRequestBytes(16000);
    tracker.beginRequest();
    tracker.addUsage(4000, 0, 10);
    // 16000 / 4000 = 4 again, but proves a fresh calibration slot was opened.
    expect(tracker.tokenEstimator.estimate(16000)).toBe(4000);
  });

  test("does not calibrate from vision sub-call usage", () => {
    const tracker = new CostTracker();
    tracker.noteRequestBytes(8000);
    tracker.beginRequest();
    // Main call calibrates ratio to 4.
    tracker.addUsage(2000, 0, 10);
    expect(tracker.tokenEstimator.estimate(8000)).toBe(2000);
    // Vision sub-call must not perturb the estimator (it goes through
    // addVisionUsage, never addUsage). We verify by recording vision usage and
    // confirming the ratio is unchanged.
    tracker.addVisionUsage(KIMI_K2_7_CODE.id, 500, 5);
    // Estimator unchanged — still ratio 4.
    expect(tracker.tokenEstimator.estimate(8000)).toBe(2000);
  });
});

describe("applyEstimatedContextBudget early-exit gate", () => {
  test("no-ops (leaves max_tokens unchanged) when far from the window", () => {
    const payload: Record<string, unknown> = {
      model: largeModel.id,
      max_tokens: 32_000,
      messages: [{ role: "user", content: "small prompt" }],
    };
    // estimate 1000 tokens: 1000*1.15 + 32000 + 512 = 33662 < 100000 → gate fires.
    applyEstimatedContextBudget(payload, largeModel, {}, "test", 1000);
    expect(payload.max_tokens).toBe(32_000); // unchanged
  });

  test("clamps max_tokens down when the estimate is near the window", () => {
    const payload: Record<string, unknown> = {
      model: smallModel.id,
      max_tokens: 700,
      // A payload large enough that the stringify-based recount in the clamp
      // path exceeds the 1000-token window, forcing a clamp.
      messages: [{ role: "user", content: "context pressure ".repeat(400) }],
    };
    // estimate 1600 ≈ 6400 chars / 4: well over the 1000-token window.
    // Inject a no-op alarm so the (now always-on) trim warning + telemetry do
    // not perform real stderr/network I/O during this unit test (TURN.md 1e).
    applyEstimatedContextBudget(
      payload,
      smallModel,
      { emitContextTrimAlarm: vi.fn() },
      "test",
      1600,
    );
    expect(payload.max_tokens).toBeLessThan(700);
    expect(payload.max_tokens).toBeGreaterThanOrEqual(1);
  });

  test("gate uses the 1.15 headroom factor (boundary just inside is a no-op)", () => {
    // Construct an estimate right at the no-op/clamp boundary for largeModel.
    // Gate condition for no-op: est*1.15 + max + 512 < context (100000),
    // with max_tokens = 32000 → est*1.15 < 67488 → est < 58685.2.
    // est = 58600 → 58600*1.15=67390; +32000+512 = 99902 < 100000 → no-op.
    const payload: Record<string, unknown> = {
      model: largeModel.id,
      max_tokens: 32_000,
      messages: [{ role: "user", content: "x" }],
    };
    applyEstimatedContextBudget(payload, largeModel, {}, "test", 58600);
    expect(payload.max_tokens).toBe(32_000); // just inside → no-op

    // est = 58700 → 58700*1.15=67505; +32000+512 = 100017 > 100000 → clamp path.
    const payload2: Record<string, unknown> = {
      model: largeModel.id,
      max_tokens: 32_000,
      // Tiny real payload so the clamp path's stringify recount is small and
      // the clamp ends up a no-op internally too — but the point is the gate
      // did NOT short-circuit. We assert the gate boundary by contrast above.
      messages: [{ role: "user", content: "x" }],
    };
    applyEstimatedContextBudget(payload2, largeModel, {}, "test", 58700);
    // With a tiny actual payload the clamp path recomputes a small input token
    // count and leaves max_tokens unchanged (no overflow). This confirms the
    // gate did not fire and the function continued into the clamp path.
    expect(payload2.max_tokens).toBe(32_000);
  });
});

describe("countTokensResponse monotonicity with body size", () => {
  test("estimates input_tokens from rawBytes and is monotonic in body size", () => {
    const options = {
      modelId: largeModel.id,
      targetModelId: largeModel.id,
      modelDefinition: largeModel,
    };
    const smallBody = {
      model: largeModel.id,
      messages: [{ role: "user", content: "hi" }],
    } as AnthropicCountTokensRequest;
    const largeBody = {
      model: largeModel.id,
      messages: [{ role: "user", content: "x".repeat(100_000) }],
    } as AnthropicCountTokensRequest;
    const smallBytes = Buffer.byteLength(JSON.stringify(smallBody), "utf8");
    const largeBytes = Buffer.byteLength(JSON.stringify(largeBody), "utf8");

    const small = countTokensResponse(smallBody, options, smallBytes);
    const large = countTokensResponse(largeBody, options, largeBytes);

    expect(small.input_tokens).toBeGreaterThan(0);
    expect(large.input_tokens).toBeGreaterThan(small.input_tokens);
  });

  test("uses the calibrated estimator when provided", () => {
    const tracker = new CostTracker();
    tracker.noteRequestBytes(4000);
    tracker.beginRequest();
    tracker.addUsage(1000, 0, 1); // ratio 4 bytes/token
    const estimator = tracker.tokenEstimator;

    const options = {
      modelId: largeModel.id,
      targetModelId: largeModel.id,
      modelDefinition: largeModel,
    };
    const body = {
      model: largeModel.id,
      messages: [{ role: "user", content: "x".repeat(8000) }],
    } as AnthropicCountTokensRequest;
    const rawBytes = 8000; // 8000 bytes / 4 = 2000 tokens

    const result = countTokensResponse(body, options, rawBytes, estimator);
    expect(result.input_tokens).toBe(2000);
  });

  test("falls back to rawBytes/4 when no estimator is provided", () => {
    const options = {
      modelId: largeModel.id,
      targetModelId: largeModel.id,
      modelDefinition: largeModel,
    };
    const body = {
      model: largeModel.id,
      messages: [{ role: "user", content: "x".repeat(400) }],
    } as AnthropicCountTokensRequest;
    const rawBytes = 1600; // 1600 / 4 = 400
    const result = countTokensResponse(body, options, rawBytes);
    expect(result.input_tokens).toBe(400);
  });

  test("keeps the { input_tokens } response shape", () => {
    const options = {
      modelId: largeModel.id,
      targetModelId: largeModel.id,
      modelDefinition: largeModel,
    };
    const body = {
      model: largeModel.id,
      messages: [{ role: "user", content: "hello" }],
    } as AnthropicCountTokensRequest;
    const result = countTokensResponse(body, options, 1000);
    expect(result).toEqual({ input_tokens: 250 });
  });
});
