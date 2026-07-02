import { describe, expect, test } from "vitest";
import type { ModelDefinition } from "../../models/src/index.js";
import {
  applyEstimatedContextBudget,
  parseTogetherContextLengthInputTokens,
  parseTogetherContextLengthMaxTokens,
  trimPayloadInputByApproxTokens,
} from "../../cli/src/lib/claude/context-budget.js";

const model: ModelDefinition = {
  id: "test/context-model",
  name: "Context Model",
  anthropicAlias: "context-model",
  cost: { input: 0, output: 0, cache_read: 0 },
  limit: { context: 1000, output: 700 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

describe("Claude context budget utilities", () => {
  test("parses Together context length token counts from common error shapes", () => {
    const parenthetical =
      "This model's maximum context length is 262,144 tokens. Please reduce your prompt; (258_001 input tokens, 2048 output tokens).";
    const resolved =
      "Request rejected: request resolved to 300,005 input tokens and 32,000 output tokens.";

    expect(parseTogetherContextLengthMaxTokens(parenthetical)).toBe(262144);
    expect(parseTogetherContextLengthInputTokens(parenthetical)).toBe(258001);
    expect(parseTogetherContextLengthInputTokens(resolved)).toBe(300005);
  });

  test("clamps max_tokens to leave estimated context headroom", () => {
    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 700,
      messages: [{ role: "user", content: "context pressure ".repeat(400) }],
    };

    applyEstimatedContextBudget(payload, model, {}, "test");

    expect(payload.max_tokens).toBeLessThan(700);
    expect(payload.max_tokens).toBeGreaterThanOrEqual(1);
  });

  test("trims old non-system context by approximate token budget", () => {
    const longText = "keep-prefix " + "older context ".repeat(1000);
    const payload: Record<string, unknown> = {
      messages: [
        { role: "system", content: "system content should not be trimmed" },
        { role: "user", content: longText },
      ],
    };

    const result = trimPayloadInputByApproxTokens(payload, 300);
    const messages = payload.messages as Array<{ role: string; content: string }>;

    expect(result?.trimmedChars).toBeGreaterThan(0);
    expect(messages[0]?.content).toBe("system content should not be trimmed");
    expect(messages[1]?.content).toContain(
      "[togetherlink trimmed older context to fit the model window]",
    );
    expect(messages[1]?.content.length).toBeLessThan(longText.length);
  });
});
