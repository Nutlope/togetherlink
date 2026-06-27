import { describe, expect, test } from "vitest";
import { buildCodexAppConfig } from "../../cli/src/lib/codex-app.js";

describe("Codex App alpha config", () => {
  test("adds the managed provider block without dropping existing tables", () => {
    const config = buildCodexAppConfig(
      [
        'model = "gpt-5.5"',
        'model_reasoning_effort = "high"',
        "",
        "[projects.\"/repo\"]",
        'trust_level = "trusted"',
        "",
      ].join("\n"),
      {
        modelId: "zai-org/GLM-5.2",
        providerId: "togetherlink_codex_app",
        providerName: "Togetherlink Codex App (alpha)",
        baseUrl: "http://127.0.0.1:7878/session/local-secret/v1",
        bearerToken: "local-secret",
        catalogPath: "/tmp/models.json",
      },
    );

    expect(config).toContain('model = "zai-org/GLM-5.2"');
    expect(config).toContain('model_provider = "togetherlink_codex_app"');
    expect(config).toContain('model_catalog_json = "/tmp/models.json"');
    expect(config).toContain('[projects."/repo"]');
    expect(config).toContain("[model_providers.togetherlink_codex_app]");
    expect(config).toContain('base_url = "http://127.0.0.1:7878/session/local-secret/v1"');
    expect(config).toContain('experimental_bearer_token = "local-secret"');
  });

  test("replaces an existing managed block instead of appending duplicates", () => {
    const first = buildCodexAppConfig("", {
      modelId: "zai-org/GLM-5.2",
      providerId: "togetherlink_codex_app",
      providerName: "Togetherlink Codex App (alpha)",
      baseUrl: "http://127.0.0.1:7878/session/old/v1",
      bearerToken: "old",
      catalogPath: "/tmp/old.json",
    });
    const second = buildCodexAppConfig(first, {
      modelId: "moonshotai/Kimi-K2.7-Code",
      providerId: "togetherlink_codex_app",
      providerName: "Togetherlink Codex App (alpha)",
      baseUrl: "http://127.0.0.1:7878/session/new/v1",
      bearerToken: "new",
      catalogPath: "/tmp/new.json",
    });

    expect(second.match(/>>> togetherlink codex-app alpha >>>/g)).toHaveLength(1);
    expect(second).not.toContain("/tmp/old.json");
    expect(second).not.toContain("/session/old/v1");
    expect(second).toContain('model = "moonshotai/Kimi-K2.7-Code"');
    expect(second).toContain("/session/new/v1");
  });
});
