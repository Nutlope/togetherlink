import { describe, expect, test, vi } from "vitest";
import { DEFAULT_MODEL } from "@togetherlink/models";
import { ALL_HARNESSES, HARNESS } from "../../cli/src/lib/harness.js";
import {
  CUSTOM_MODEL_HARNESS_POLICY,
  resolveTogetherModel,
} from "../../cli/src/lib/together-model.js";

const CUSTOM_ID = "future-org/Future-Chat-1";

function catalogResponse(model: Record<string, unknown>): Response {
  return new Response(JSON.stringify([model]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Together model resolution", () => {
  test("keeps defaults and curated selections static without calling the catalog", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      resolveTogetherModel({
        requestedModel: undefined,
        apiKey: "runtime-credential",
        baseUrl: "https://api.together.ai/v1",
        harness: HARNESS.CODEX,
        fetchImpl,
      }),
    ).resolves.toMatchObject({ definition: DEFAULT_MODEL, custom: false, warnings: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("validates an explicit exact chat id and derives only catalog-backed metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      catalogResponse({
        id: CUSTOM_ID,
        type: "chat",
        display_name: "Future Chat 1",
        context_length: 131_072,
        pricing: { input: 0.2, output: 0.8, cached_input: 0.05 },
      }),
    );

    const resolved = await resolveTogetherModel({
      requestedModel: CUSTOM_ID,
      apiKey: "runtime-credential",
      baseUrl: "https://api.together.ai/v1",
      harness: HARNESS.CODEX,
      fetchImpl,
    });

    expect(resolved).toMatchObject({
      custom: true,
      definition: {
        id: CUSTOM_ID,
        name: "Future Chat 1",
        anthropicAlias: null,
        cost: { input: 0.2, output: 0.8, cache_read: 0.05 },
        limit: { context: 131_072, output: 8_192 },
        attachment: false,
        reasoning: false,
        temperature: false,
        tool_call: false,
        modalities: { input: ["text"], output: ["text"] },
      },
    });
    expect(resolved.warnings.join(" ")).toContain("8,192-token conservative output limit");
    expect(resolved.warnings.join(" ")).toContain(
      "not advertising vision, reasoning, or tool support",
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  test("rejects missing ids without a curated fallback and uses harness-neutral wording", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      catalogResponse({
        id: "someone/Else",
        type: "chat",
      }),
    );

    await expect(
      resolveTogetherModel({
        requestedModel: CUSTOM_ID,
        apiKey: "runtime-credential",
        baseUrl: "https://api.together.ai/v1",
        harness: HARNESS.DEEPSEEK,
        fetchImpl,
      }),
    ).rejects.toThrow(
      `Model "${CUSTOM_ID}" is not an exact match in Together's authenticated model catalog`,
    );
  });

  test("rejects exact non-chat catalog entries clearly", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        catalogResponse({ id: CUSTOM_ID, type: "image", display_name: "Future Image" }),
      );

    await expect(
      resolveTogetherModel({
        requestedModel: CUSTOM_ID,
        apiKey: "runtime-credential",
        baseUrl: "https://api.together.ai/v1",
        harness: HARNESS.OPENCODE,
        fetchImpl,
      }),
    ).rejects.toThrow(`catalog type is "image"; --model accepts chat models only`);
  });

  test("fails with a harness-specific pricing error when honest reporting/config is impossible", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      catalogResponse({
        id: CUSTOM_ID,
        type: "chat",
        display_name: "Future Chat 1",
        context_length: 65_536,
        pricing: {},
      }),
    );

    await expect(
      resolveTogetherModel({
        requestedModel: CUSTOM_ID,
        apiKey: "runtime-credential",
        baseUrl: "https://api.together.ai/v1",
        harness: HARNESS.CLAUDE,
        fetchImpl,
      }),
    ).rejects.toThrow("Claude Code cannot safely use this custom model");
  });
});

describe("custom model harness policy", () => {
  test("covers every registered harness so additions cannot bypass validation", () => {
    expect(Object.keys(CUSTOM_MODEL_HARNESS_POLICY).sort()).toEqual([...ALL_HARNESSES].sort());
  });
});
