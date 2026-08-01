import { describe, expect, test } from "vitest";
import type { ModelDefinition } from "../../models/src/index.js";
import {
  EMPTY_CODEX_TOOL_TRANSLATION,
  toChatPayload,
} from "../../cli/src/lib/codex/translate-request.js";
import type { ResponsesRequest } from "../../cli/src/lib/codex/wire-types.js";

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
});
