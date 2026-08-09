import { DEFAULT_MODEL, SELECTABLE_MODELS, TOGETHER_BASE_URL } from "@togetherlink/models";
import { describe, expect, test } from "vitest";
import { buildOmpModelsJson } from "../../cli/src/lib/harnesses/omp.js";

describe("Oh My Pi harness configuration", () => {
  test("builds a complete ephemeral Together provider for current omp", () => {
    const config = JSON.parse(buildOmpModelsJson("test-key")) as {
      providers: {
        together: {
          api: string;
          apiKey: string;
          baseUrl: string;
          models: Array<{
            id: string;
            input: string[];
            supportsTools: boolean;
          }>;
        };
      };
    };
    const provider = config.providers.together;

    expect(provider.api).toBe("openai-completions");
    expect(provider.apiKey).toBe("test-key");
    expect(provider.baseUrl).toBe(TOGETHER_BASE_URL);
    expect(provider.models.map((model) => model.id)).toEqual(
      SELECTABLE_MODELS.map((model) => model.id),
    );
    expect(provider.models[0]).toMatchObject({
      id: DEFAULT_MODEL.id,
      input: ["text", "image"],
      supportsTools: true,
    });
  });

  test("honors a Together-compatible credential proxy URL", () => {
    const config = JSON.parse(buildOmpModelsJson("proxy-key", "https://proxy.test/v1")) as {
      providers: { together: { baseUrl: string } };
    };

    expect(config.providers.together.baseUrl).toBe("https://proxy.test/v1");
  });
});
