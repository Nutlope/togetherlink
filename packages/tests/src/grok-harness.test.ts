import { describe, expect, test } from "vitest";
import { GLM_5_2, SELECTABLE_MODELS, VISION_PRIMARY } from "@togetherlink/models";
import {
  buildGrokLaunchEnvironment,
  buildGrokModelCatalog,
  buildGrokIdentityRule,
  grokArgsWithoutTogetherlinkOverrides,
  grokArgsWithTogetherlinkIdentity,
  GROK_IDENTITY_RULE,
  startGrokModelCatalogServer,
} from "../../cli/src/lib/grok/core.js";
import { claimsXaiIdentity } from "./harnesses/grok.js";

describe("Grok harness", () => {
  test("does not mistake an explicit xAI denial for an xAI identity claim", () => {
    expect(claimsXaiIdentity("I'm a Together AI model via togetherlink, not xAI.")).toBe(false);
    expect(claimsXaiIdentity("I am not an xAI model; Together AI serves this session.")).toBe(
      false,
    );
    expect(claimsXaiIdentity("I'm not Grok and wasn't built by xAI.")).toBe(false);
    expect(claimsXaiIdentity("I am an xAI model.")).toBe(true);
    expect(claimsXaiIdentity("I was built by xAI and served by Together AI.")).toBe(true);
  });

  test("makes the selected Together backend distinct from the Grok terminal harness", () => {
    expect(GROK_IDENTITY_RULE).toBe(
      "Grok Build is only the terminal harness. You are the selected Together AI model via togetherlink, not Grok or an xAI model. For identity questions, name the selected backend and Together AI; never claim xAI built or serves you.",
    );
    expect(buildGrokIdentityRule(GLM_5_2)).toContain(
      `You are ${GLM_5_2.name} (${GLM_5_2.id}), served by Together AI via togetherlink.`,
    );
  });

  test("adapts the curated models to Grok's wrapped catalog shape", () => {
    const catalog = buildGrokModelCatalog("https://api.together.ai/v1");

    expect(catalog.object).toBe("list");
    expect(catalog.data).toHaveLength(SELECTABLE_MODELS.length);
    for (const model of SELECTABLE_MODELS) {
      expect(catalog.data).toContainEqual({
        id: model.id,
        model: model.id,
        name: `Together AI · ${model.name}`,
        description: `Direct Together API model: ${model.id}`,
        base_url: "https://api.together.ai/v1",
        api_backend: "chat_completions",
        context_window: model.limit.context,
        max_completion_tokens: Math.min(model.limit.output, 8192),
        user_selectable: true,
      });
    }
  });

  test("uses the real Grok home while isolating only auth and enabling workflows", () => {
    const env = buildGrokLaunchEnvironment({
      inheritedEnv: {
        GROK_HOME: "/users/custom-grok-home",
        GROK_AUTH: '{"xai":{"key":"saved-xai-session"}}',
        GROK_DISABLE_API_KEY_AUTH: "1",
      },
      apiKey: "together-key",
      authPath: "/tmp/togetherlink-grok-auth/no-auth.json",
      baseUrl: "https://api.together.ai/v1",
      modelsListUrl: "http://127.0.0.1:4242/v1/models",
      selectedModel: GLM_5_2,
    });

    expect(env.GROK_HOME).toBe("/users/custom-grok-home");
    expect(env.GROK_AUTH_PATH).toBe("/tmp/togetherlink-grok-auth/no-auth.json");
    expect(env.GROK_AUTH).toBeUndefined();
    expect(env.GROK_DISABLE_API_KEY_AUTH).toBeUndefined();
    expect(env.XAI_API_KEY).toBe("together-key");
    expect(env.TOGETHER_API_KEY).toBe("together-key");
    expect(env.GROK_MODELS_BASE_URL).toBe("https://api.together.ai/v1");
    expect(env.GROK_MODELS_LIST_URL).toBe("http://127.0.0.1:4242/v1/models");
    expect(env.GROK_DEFAULT_MODEL).toBe(GLM_5_2.id);
    expect(env.GROK_SESSION_SUMMARY_MODEL).toBe(GLM_5_2.id);
    expect(env.GROK_IMAGE_DESCRIPTION_MODEL).toBe(VISION_PRIMARY.id);
    expect(env.GROK_PROMPT_SUGGESTIONS_MODEL).toBe(GLM_5_2.id);
    expect(env.GROK_WORKFLOWS).toBe("1");
  });

  test("does not turn a blank inherited GROK_HOME into a new override", () => {
    const env = buildGrokLaunchEnvironment({
      inheritedEnv: { GROK_HOME: "   " },
      apiKey: "together-key",
      authPath: "/tmp/no-auth.json",
      baseUrl: "https://api.together.ai/v1",
      modelsListUrl: "http://127.0.0.1:4242/v1/models",
      selectedModel: GLM_5_2,
    });

    expect(env.GROK_HOME).toBeUndefined();
  });

  test("routes optional AI shell suggestions through the selected Together model", () => {
    const env = buildGrokLaunchEnvironment({
      inheritedEnv: {
        GROK_SUGGESTIONS_AI: "1",
        GROK_SUGGESTIONS_AI_MODEL: "grok-build",
      },
      apiKey: "together-key",
      authPath: "/tmp/no-auth.json",
      baseUrl: "https://api.together.ai/v1",
      modelsListUrl: "http://127.0.0.1:4242/v1/models",
      selectedModel: GLM_5_2,
    });

    expect(env.GROK_SUGGESTIONS_AI).toBe("1");
    expect(env.GROK_SUGGESTIONS_AI_MODEL).toBe(GLM_5_2.id);
  });

  test("disables xAI-only Imagine tools without changing goal subagent policy", () => {
    const env = buildGrokLaunchEnvironment({
      inheritedEnv: {
        GROK_IMAGE_GEN: "1",
        GROK_IMAGE_EDIT: "1",
        GROK_GOAL_USE_CURRENT_MODEL_ONLY: "0",
      },
      apiKey: "together-key",
      authPath: "/tmp/no-auth.json",
      baseUrl: "https://api.together.ai/v1",
      modelsListUrl: "http://127.0.0.1:4242/v1/models",
      selectedModel: GLM_5_2,
    });

    expect(env.GROK_IMAGE_GEN).toBe("0");
    expect(env.GROK_IMAGE_EDIT).toBe("0");
    expect(env.GROK_GOAL_USE_CURRENT_MODEL_ONLY).toBe("0");
  });

  test("serves only the Grok-compatible local model catalog", async () => {
    const catalogServer = await startGrokModelCatalogServer("https://api.together.ai/v1");
    try {
      const response = await fetch(catalogServer.modelsListUrl, {
        headers: { Authorization: "Bearer secret-that-must-not-be-reflected" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(buildGrokModelCatalog("https://api.together.ai/v1"));

      const unsupported = await fetch(new URL("/v1/chat/completions", catalogServer.modelsListUrl));
      expect(unsupported.status).toBe(404);
    } finally {
      await catalogServer.close();
    }
  });

  test("removes Grok model overrides owned by togetherlink", () => {
    expect(
      grokArgsWithoutTogetherlinkOverrides([
        "--model",
        "xai-model",
        "-mother-model",
        "--model=other-model",
        "-mthird-model",
        "-p",
        "hello",
      ]),
    ).toEqual(["-p", "hello"]);
  });

  test("appends Togetherlink identity while preserving user prompt rules", () => {
    expect(
      grokArgsWithTogetherlinkIdentity(["--rules", "Always use pnpm.", "-p", "hello"]),
    ).toEqual([
      "--disable-web-search",
      "--rules",
      `${GROK_IDENTITY_RULE}\n\nAlways use pnpm.`,
      "-p",
      "hello",
    ]);

    expect(
      grokArgsWithTogetherlinkIdentity([
        "--system-prompt-override=You are a coding agent.",
        "-p",
        "hello",
      ]),
    ).toEqual([
      "--disable-web-search",
      `--system-prompt-override=You are a coding agent.\n\n${GROK_IDENTITY_RULE}`,
      "-p",
      "hello",
    ]);
  });

  test("disables Grok native web search once even when the user passes the flag", () => {
    expect(grokArgsWithTogetherlinkIdentity(["--disable-web-search", "-p", "hello"])).toEqual([
      "--disable-web-search",
      "--rules",
      GROK_IDENTITY_RULE,
      "-p",
      "hello",
    ]);
  });
});
