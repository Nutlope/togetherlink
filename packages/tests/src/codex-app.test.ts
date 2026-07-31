import { describe, expect, test } from "vitest";
import { DEFAULT_MODEL } from "@togetherlink/models";
import { buildCodexAppConfig, codexAppModelCatalogJson } from "../../cli/src/lib/codex-app.js";

describe("Codex App alpha config", () => {
  test("adds the Together router without replacing the native OpenAI provider", () => {
    const config = buildCodexAppConfig(
      [
        'model = "gpt-5.5"',
        'model_provider = "openai"',
        'openai_base_url = "https://api.openai.com/v1"',
        'model_reasoning_effort = "high"',
        "",
        '[projects."/repo"]',
        'trust_level = "trusted"',
        "",
      ].join("\n"),
      {
        modelId: "zai-org/GLM-5.2",
        providerId: "togetherlink_codex_app",
        providerName: "Togetherlink",
        baseUrl: "http://127.0.0.1:7878/session/local-secret/v1",
        bearerToken: "local-secret",
        catalogPath: "/tmp/models.json",
      },
    );

    expect(config).toContain('model = "zai-org/GLM-5.2"');
    expect(config).toContain('model_provider = "openai"');
    expect(config).toContain('model_catalog_json = "/tmp/models.json"');
    expect(config).not.toContain("approval_policy");
    expect(config).not.toContain("model_context_window");
    expect(config).not.toContain("model_auto_compact_token_limit");
    expect(config).toContain('model_reasoning_effort = "high"');
    expect(config).toContain('openai_base_url = "http://127.0.0.1:7878/session/local-secret/v1"');
    expect(config).toContain(
      'experimental_realtime_webrtc_call_base_url = "https://chatgpt.com/backend-api/codex"',
    );
    expect(config).toContain('experimental_realtime_ws_base_url = "https://api.openai.com/v1"');
    expect(config).toContain('[projects."/repo"]');
    expect(config).toContain("[model_providers.togetherlink_codex_app]");
    expect(config).toContain('name = "Togetherlink"');
    expect(config).toContain('base_url = "http://127.0.0.1:7878/session/local-secret/v1"');
    expect(config).toContain('wire_api = "responses"');
    expect(config).not.toContain("requires_openai_auth");
  });

  test("replaces an existing managed block instead of appending duplicates", () => {
    const first = buildCodexAppConfig("", {
      modelId: "zai-org/GLM-5.2",
      providerId: "togetherlink_codex_app",
      providerName: "Togetherlink",
      baseUrl: "http://127.0.0.1:7878/session/old/v1",
      bearerToken: "old",
      catalogPath: "/tmp/old.json",
    });
    const second = buildCodexAppConfig(first, {
      modelId: "moonshotai/Kimi-K2.7-Code",
      providerId: "togetherlink_codex_app",
      providerName: "Togetherlink",
      baseUrl: "http://127.0.0.1:7878/session/new/v1",
      bearerToken: "new",
      catalogPath: "/tmp/new.json",
    });

    expect(second.match(/>>> togetherlink codex-app alpha >>>/g)).toHaveLength(1);
    expect(second).not.toContain("/tmp/old.json");
    expect(second).not.toContain("/session/old/v1");
    expect(second).toContain('model = "moonshotai/Kimi-K2.7-Code"');
    expect(second).not.toContain("model_provider =");
    expect(second.match(/approval_policy = "on-request"/g)).toHaveLength(1);
    expect(second.match(/sandbox_mode = "workspace-write"/g)).toHaveLength(1);
    expect(second.match(/approvals_reviewer = "auto_review"/g)).toHaveLength(1);
    expect(second).toContain('openai_base_url = "http://127.0.0.1:7878/session/new/v1"');
    expect(second).toContain('base_url = "http://127.0.0.1:7878/session/new/v1"');
    expect(second).toContain("/session/new/v1");
  });

  test("preserves the native default and user-owned realtime endpoints when no model is requested", () => {
    const config = buildCodexAppConfig(
      [
        'model = "gpt-5.6-sol"',
        'model_provider = "openai"',
        'experimental_realtime_webrtc_call_base_url = "https://voice.example/calls"',
        'experimental_realtime_ws_base_url = "wss://voice.example/live"',
      ].join("\n"),
      {
        providerId: "togetherlink_codex_app",
        providerName: "Togetherlink",
        baseUrl: "http://127.0.0.1:7878/session/local-secret/v1",
        bearerToken: "local-secret",
        catalogPath: "/tmp/models.json",
      },
    );

    expect(config).toContain('model = "gpt-5.6-sol"');
    expect(config).toContain('model_provider = "openai"');
    expect(config).toContain(
      'experimental_realtime_webrtc_call_base_url = "https://voice.example/calls"',
    );
    expect(config).toContain('experimental_realtime_ws_base_url = "wss://voice.example/live"');
  });

  test("removes legacy app profile and provider tables", () => {
    const config = buildCodexAppConfig(
      [
        'profile = "togetherlink_codex_app"',
        "",
        "[profiles.togetherlink_codex_app]",
        'model = "stale"',
        "",
        "[model_providers.togetherlink_codex_app]",
        'base_url = "http://old.invalid/v1"',
        "",
        '[projects."/repo"]',
        'trust_level = "trusted"',
        "",
      ].join("\n"),
      {
        modelId: "zai-org/GLM-5.2",
        providerId: "togetherlink_codex_app",
        providerName: "Togetherlink",
        baseUrl: "http://127.0.0.1:7878/session/local-secret/v1",
        bearerToken: "local-secret",
        catalogPath: "/tmp/models.json",
      },
    );

    expect(config).not.toContain('profile = "togetherlink_codex_app"');
    expect(config.match(/\[profiles\.togetherlink_codex_app\]/g)).toBeNull();
    expect(config.match(/\[model_providers\.togetherlink_codex_app\]/g)).toHaveLength(1);
    expect(config).not.toContain("http://old.invalid/v1");
    expect(config).toContain('[projects."/repo"]');
  });

  test("preserves an existing approval policy preference", () => {
    const config = buildCodexAppConfig(
      ['approval_policy = "never"', "", '[projects."/repo"]', 'trust_level = "trusted"', ""].join(
        "\n",
      ),
      {
        modelId: "zai-org/GLM-5.2",
        providerId: "togetherlink_codex_app",
        providerName: "Togetherlink",
        baseUrl: "http://127.0.0.1:7878/session/local-secret/v1",
        bearerToken: "local-secret",
        catalogPath: "/tmp/models.json",
      },
    );

    expect(config).toContain('approval_policy = "never"');
    expect(config).not.toContain('approval_policy = "on-request"');
    expect(config).not.toContain('approvals_reviewer = "auto_review"');
  });

  test("emits the full ModelInfo schema Codex Desktop expects", () => {
    const catalog = JSON.parse(codexAppModelCatalogJson()) as {
      models: Array<Record<string, unknown>>;
    };
    const first = catalog.models[0];

    expect(first).toBeDefined();
    expect(first?.display_name).toBe(DEFAULT_MODEL.name);
    expect(first?.shell_type).toBe("shell_command");
    // Reasoning models expose effort levels; non-reasoning models use "none".
    expect(first?.default_reasoning_level).toBe("high");
    expect(first?.supported_reasoning_levels).toEqual([
      { effort: "low", description: "Fast responses with lighter reasoning" },
      { effort: "high", description: "Greater reasoning depth for complex tasks" },
      { effort: "max", description: "Maximum reasoning depth for the hardest tasks" },
    ]);
    expect(first?.supports_reasoning_summaries).toBe(true);
    expect(first?.default_reasoning_summary).toBe("auto");
    expect(first?.support_verbosity).toBe(false);
    expect(first?.default_verbosity).toBe("low");

    // These fields were previously missing and caused Codex Desktop to fall
    // back to base instructions on every turn (see app log: "model_messages
    // is missing, falling back to base instructions"). They must now be present.
    expect(first?.service_tiers).toEqual([]);
    expect(first?.default_service_tier).toBeNull();
    expect(first?.use_responses_lite).toBe(false);
    expect(first?.apply_patch_tool_type).toBe("freeform");
    expect(first?.web_search_tool_type).toBe("text_and_image");
    // Truncation limit is the context window divided by the Codex↔Together
    // tokenizer-mismatch ratio, so Codex compacts before Together's
    // server-side tokenizer rejects. See codex/catalog.ts.
    expect(first?.truncation_policy).toEqual({
      mode: "tokens",
      limit: Math.floor(DEFAULT_MODEL.limit.context / 1.8),
    });
    expect(first?.comp_hash).toBeNull();
    // model_messages MUST be an object (not null) so Codex Desktop can resolve
    // the requested personality instead of warning and falling back.
    expect(first?.model_messages).toEqual(
      expect.objectContaining({
        instructions_template: expect.stringContaining("{{ personality }}"),
        instructions_variables: expect.objectContaining({
          personality_default: "",
          personality_friendly: expect.any(String),
          personality_pragmatic: expect.any(String),
        }),
      }),
    );
    expect(first?.supports_personality).toBe(true);
    // Per-model capability flags must be derived from the model definition,
    // not hardcoded off, so vision/tool-calling models are advertised correctly.
    expect(first?.supports_parallel_tool_calls).toBe(true);
    expect(first?.supports_image_detail_original).toBe(DEFAULT_MODEL.attachment);
    expect(first?.input_modalities).toEqual(DEFAULT_MODEL.modalities.input);

    // A vision-capable model in the catalog must advertise image input.
    const vision = catalog.models.find((m) => m.slug === "moonshotai/Kimi-K2.6");
    expect(vision?.supports_image_detail_original).toBe(true);
    expect(vision?.input_modalities).toEqual(["text", "image"]);
  });

  test("merges native GPT and Together models into one picker catalog", () => {
    const catalog = JSON.parse(
      codexAppModelCatalogJson({
        models: [
          {
            slug: "gpt-5.6-sol",
            display_name: "GPT-5.6-Sol",
            priority: 1,
            native_marker: "preserved",
          },
          { slug: "gpt-5.6-terra", display_name: "GPT-5.6-Terra", priority: 2 },
        ],
      }),
    ) as { models: Array<Record<string, unknown>> };

    expect(catalog.models.map((model) => model.slug)).toEqual(
      expect.arrayContaining(["gpt-5.6-sol", "gpt-5.6-terra", DEFAULT_MODEL.id]),
    );
    expect(catalog.models.find((model) => model.slug === "gpt-5.6-sol")).toMatchObject({
      display_name: "GPT-5.6-Sol",
      native_marker: "preserved",
    });
    expect(
      catalog.models.find((model) => model.slug === DEFAULT_MODEL.id)?.priority,
    ).toBeGreaterThan(2);
  });
});
