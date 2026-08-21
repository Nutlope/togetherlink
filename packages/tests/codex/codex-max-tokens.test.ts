import { describe, expect, test } from "vitest";
import type { ModelDefinition } from "../../models/src/index.js";
import {
  EMPTY_CODEX_TOOL_TRANSLATION,
  toChatPayload,
} from "../../cli/src/lib/codex/translate-request.js";
import type { ResponsesRequest } from "../../cli/src/lib/codex/wire-types.js";
import { isTruncationReal, MIN_PREFERRED_OUTPUT_TOKENS } from "../../cli/src/lib/output-budget.js";

const model: ModelDefinition = {
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

const options = {
  modelId: model.id,
  targetModelId: model.id,
  modelName: model.name,
  modelDefinition: model,
};

function resolveModel() {
  return {
    requestedModelId: model.id,
    targetModelId: model.id,
    definition: model,
    memory: false,
  };
}

describe("Codex max output forwarding", () => {
  test("uses the model output limit when Codex omits max_output_tokens", () => {
    const request: ResponsesRequest = {
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "x".repeat(200_000) }],
        },
      ],
    };

    const payload = toChatPayload(
      request,
      options,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(),
    );

    expect(payload.max_tokens).toBe(32_000);
  });

  test("reserves enough context for input before Codex reaches its compaction threshold", () => {
    const request: ResponsesRequest = {
      input: [{ type: "message", role: "user", content: "long conversation" }],
    };

    const payload = toChatPayload(
      request,
      options,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(),
      75_000,
    );

    expect(payload.max_tokens).toBe(24_488);
  });

  test("passes an explicit client max_output_tokens through unchanged", () => {
    const request: ResponsesRequest = {
      max_output_tokens: 1_234,
      input: [{ type: "message", role: "user", content: "Hi." }],
    };

    const payload = toChatPayload(
      request,
      options,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(),
    );

    expect(payload.max_tokens).toBe(1_234);
  });

  test("never collapses the budget to a token when the input estimate overshoots", () => {
    const request: ResponsesRequest = {
      input: [{ type: "message", role: "user", content: "long conversation" }],
    };

    // An estimate far past the window — what an image-heavy Codex history
    // produced before images were excluded from text budgeting. Asking for a
    // 1-token reply makes Together answer `finish_reason: "length"` on every
    // attempt, which Codex reports as a fatal truncation forever.
    const payload = toChatPayload(
      request,
      options,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(),
      5_000_000,
    );

    expect(payload.max_tokens).toBe(MIN_PREFERRED_OUTPUT_TOKENS);
  });

  test("keeps the floor under the ceiling for a small explicit client cap", () => {
    const request: ResponsesRequest = {
      max_output_tokens: 500,
      input: [{ type: "message", role: "user", content: "long conversation" }],
    };

    const payload = toChatPayload(
      request,
      options,
      false,
      EMPTY_CODEX_TOOL_TRANSLATION,
      resolveModel(),
      5_000_000,
    );

    expect(payload.max_tokens).toBe(500);
  });
});

describe("Together length-stop arbitration", () => {
  test("believes a length stop that reached the requested budget", () => {
    expect(isTruncationReal("length", { outputTokens: 32_000, requestedMaxTokens: 32_000 })).toBe(
      true,
    );
  });

  test("believes a length stop that came within 10% of the budget", () => {
    expect(isTruncationReal("length", { outputTokens: 29_000, requestedMaxTokens: 32_000 })).toBe(
      true,
    );
  });

  test("believes a length stop a few hundred tokens short of a small budget", () => {
    expect(isTruncationReal("length", { outputTokens: 1_200, requestedMaxTokens: 2_048 })).toBe(
      true,
    );
  });

  // The Codex incident: Together reported `length` on a turn that produced 84
  // tokens against a 131,072 budget. Believing it made Codex discard the turn
  // as "stream disconnected before completion", and because the same prompt
  // reproduced the same stop, every retry failed identically.
  test("rejects a length stop that stopped far short of the budget", () => {
    expect(isTruncationReal("length", { outputTokens: 84, requestedMaxTokens: 131_072 })).toBe(
      false,
    );
  });

  test("believes a length stop when usage is unavailable", () => {
    expect(isTruncationReal("length", undefined)).toBe(true);
    expect(isTruncationReal("length", { requestedMaxTokens: 32_000 })).toBe(true);
  });

  test("never reports truncation for a non-length finish reason", () => {
    expect(isTruncationReal("stop", { outputTokens: 84, requestedMaxTokens: 131_072 })).toBe(false);
    expect(isTruncationReal("tool_calls", undefined)).toBe(false);
    expect(isTruncationReal(undefined, undefined)).toBe(false);
  });
});
