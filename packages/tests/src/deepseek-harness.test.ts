import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { KIMI_K3, SELECTABLE_MODELS } from "@togetherlink/models";
import { resolveCodexModel } from "../../cli/src/lib/codex/defaults.js";
import {
  buildDeepseekLaunchSpec,
  buildDeepseekPatch,
  resolveDeepseekPatchPath,
  writeDeepseekPatch,
} from "../../cli/src/lib/deepseek/core.js";
import { HARNESS, HARNESS_BIN, HARNESS_INSTALL } from "../../cli/src/lib/harness.js";
import { loadHarness } from "../../cli/src/lib/harness-registry.js";
import { ensureHarnessInstalled } from "../../cli/src/lib/install-harness.js";

describe("DeepSeek Harness alpha adapter", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test("registers the official binary and installer", () => {
    expect(HARNESS.DEEPSEEK).toBe("deepseek");
    expect(HARNESS_BIN[HARNESS.DEEPSEEK]).toBe("dsh");
    expect(HARNESS_INSTALL[HARNESS.DEEPSEEK]).toEqual({
      command: "npm install -g @deepseek-ai/dsh",
      url: "https://github.com/deepseek-ai/deepseek-harness",
    });
  });

  test("loads the alpha adapter through the harness registry", async () => {
    await expect(loadHarness(HARNESS.DEEPSEEK)).resolves.toMatchObject({
      id: "deepseek",
      label: "DeepSeek Harness (alpha)",
    });
  });

  test("installs DSH only when the DeepSeek harness is explicitly ensured", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];
    let installed = false;

    await expect(
      ensureHarnessInstalled(HARNESS.DEEPSEEK, {
        detect: () => ({ installed, path: installed ? "/usr/local/bin/dsh" : null }),
        run: async (command, args) => {
          commands.push({ command, args });
          installed = true;
          return 0;
        },
      }),
    ).resolves.toBe(true);

    expect(commands).toEqual([{ command: "npm", args: ["install", "-g", "@deepseek-ai/dsh"] }]);
  });

  test("does not run an installer when DSH is already available", async () => {
    let installerCalled = false;

    await expect(
      ensureHarnessInstalled(HARNESS.DEEPSEEK, {
        detect: () => ({ installed: true, path: "/usr/local/bin/dsh" }),
        run: async () => {
          installerCalled = true;
          return 0;
        },
      }),
    ).resolves.toBe(false);

    expect(installerCalled).toBe(false);
  });

  test("does not auto-install any harness except DeepSeek", async () => {
    let installerCalled = false;

    await expect(
      ensureHarnessInstalled(HARNESS.CLAUDE, {
        detect: () => ({ installed: false, path: null }),
        run: async () => {
          installerCalled = true;
          return 0;
        },
      }),
    ).rejects.toThrow('Claude Code is not installed or "claude" is not on PATH.');

    expect(installerCalled).toBe(false);
  });

  test("maps the curated Together catalog to DSH's pi-ai provider patch", () => {
    const patch = buildDeepseekPatch(
      resolveCodexModel(KIMI_K3.id),
      "http://127.0.0.1:1234/together/v1",
      "deepseek-secret",
    );

    expect(patch).toEqual([
      {
        id: "llm-pi-ai",
        config: {
          providers: {
            togetherlink: expect.objectContaining({
              displayName: "Together AI via TogetherLink",
              apiKeyEnv: "TOGETHER_API_KEY",
              api: "openai-completions",
              baseURL: "http://127.0.0.1:1234/together/v1",
              compat: { thinkingFormat: "together", supportsReasoningEffort: true },
            }),
          },
        },
      },
      {
        id: "agent-default-model",
        config: { provider: "togetherlink", model: KIMI_K3.id },
      },
    ]);

    const models = patch[0]?.config.providers.togetherlink.models;
    expect(models).toHaveLength(SELECTABLE_MODELS.length);
    expect(models?.find((model) => model.id === KIMI_K3.id)).toEqual({
      id: KIMI_K3.id,
      name: KIMI_K3.name,
      contextWindow: 1_048_576,
      maxTokens: 131_072,
      input: ["text", "image"],
      reasoningEfforts: { low: "low", high: "high", max: "max" },
    });
  });

  test("hides native DeepSeek models when DEEPSEEK_API_KEY is missing", () => {
    const selectedModel = resolveCodexModel(KIMI_K3.id);

    expect(
      buildDeepseekPatch(selectedModel, "https://api.together.ai/v1", undefined),
    ).toContainEqual({ id: "llm-deepseek", disabled: true });
    expect(buildDeepseekPatch(selectedModel, "https://api.together.ai/v1", "   ")).toContainEqual({
      id: "llm-deepseek",
      disabled: true,
    });
  });

  test("keeps native DeepSeek models when DEEPSEEK_API_KEY is available", () => {
    const patch = buildDeepseekPatch(
      resolveCodexModel(KIMI_K3.id),
      "https://api.together.ai/v1",
      "deepseek-secret",
    );

    expect(patch).not.toContainEqual({ id: "llm-deepseek", disabled: true });
  });

  test("writes a credential-free immutable patch under TogetherLink's home", async () => {
    const home = await mkdtemp(join(tmpdir(), "togetherlink-deepseek-home-"));
    cleanup.push(home);
    const selectedModel = resolveCodexModel(KIMI_K3.id);
    const patchPath = resolveDeepseekPatchPath(
      home,
      selectedModel,
      "https://api.together.ai/v1",
      {},
    );

    await writeDeepseekPatch(patchPath, selectedModel, "https://api.together.ai/v1", undefined);

    const source = await readFile(patchPath, "utf8");
    expect(patchPath).toContain(join(home, ".togetherlink", "deepseek-harness"));
    expect(patchPath).toMatch(/together-provider-[a-f0-9]{12}\.cordis\.yml$/);
    expect(source).toContain("apiKeyEnv: TOGETHER_API_KEY");
    expect(source).toContain("id: llm-deepseek\n  disabled: true");
    expect(source).not.toContain("together-secret");
    if (process.platform !== "win32") {
      expect((await stat(patchPath)).mode & 0o777).toBe(0o600);
    }
  });

  test("launches the web profile with the generated patch and runtime-only key", () => {
    const launch = buildDeepseekLaunchSpec({
      apiKey: "together-secret",
      baseUrl: "https://api.together.ai/v1",
      patchPath: "/tmp/together-provider.cordis.yml",
      passthrough: ["--port", "4080"],
      env: { PATH: "/usr/bin", TOGETHER_API_KEY: "inherited-key" },
    });

    expect(launch).toEqual({
      binary: "dsh",
      args: ["web", "--patch", "/tmp/together-provider.cordis.yml", "--port", "4080"],
      env: {
        PATH: "/usr/bin",
        TOGETHER_API_KEY: "together-secret",
        TOGETHER_BASE_URL: "https://api.together.ai/v1",
      },
    });
  });

  test("prevents passthrough patches from displacing TogetherLink's provider", () => {
    const launch = buildDeepseekLaunchSpec({
      apiKey: "together-secret",
      baseUrl: "https://api.together.ai/v1",
      patchPath: "/tmp/together-provider.cordis.yml",
      passthrough: ["--patch", "/tmp/override.yml", "--port=4080"],
      env: {},
    });

    expect(launch.args).toEqual([
      "web",
      "--patch",
      "/tmp/together-provider.cordis.yml",
      "--port=4080",
    ]);
  });
});
