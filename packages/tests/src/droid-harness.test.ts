import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { KIMI_K3, SELECTABLE_MODELS } from "@togetherlink/models";
import { resolveCodexModel } from "../../cli/src/lib/codex/defaults.js";
import {
  buildDroidLaunchSpec,
  buildDroidSettings,
  droidCustomModelId,
  resolveDroidSettingsPath,
  writeDroidSettings,
} from "../../cli/src/lib/droid/core.js";
import { HARNESS, HARNESS_BIN, HARNESS_INSTALL } from "../../cli/src/lib/harness.js";
import { loadHarness } from "../../cli/src/lib/harness-registry.js";

describe("Factory Droid harness", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test("registers the official binary and installer", () => {
    expect(HARNESS.DROID).toBe("droid");
    expect(HARNESS_BIN[HARNESS.DROID]).toBe("droid");
    expect(HARNESS_INSTALL[HARNESS.DROID]).toEqual({
      command: "curl -fsSL https://app.factory.ai/cli | sh",
      url: "https://factory.ai/product/cli",
    });
  });

  test("loads the Droid adapter through the harness registry", async () => {
    await expect(loadHarness(HARNESS.DROID)).resolves.toMatchObject({
      id: "droid",
      label: "Factory Droid",
    });
  });

  test("maps the curated Together catalog to Droid custom models", () => {
    const settings = buildDroidSettings({
      selectedModel: resolveCodexModel(KIMI_K3.id),
      baseUrl: "http://127.0.0.1:1234/v1",
    });

    expect(settings).toMatchObject({
      model: droidCustomModelId(KIMI_K3, 0),
      cloudSessionSync: false,
    });
    expect(settings.customModels).toHaveLength(SELECTABLE_MODELS.length);
    expect(settings.customModels[0]).toEqual({
      model: KIMI_K3.id,
      displayName: `Together AI ${KIMI_K3.name}`,
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKey: "${TOGETHER_API_KEY}",
      provider: "generic-chat-completion-api",
      maxOutputTokens: KIMI_K3.limit.output,
    });
    expect(settings.customModels.find((model) => model.noImageSupport)).toBeDefined();
  });

  test("writes credential-free runtime settings under TogetherLink home", async () => {
    const home = await mkdtemp(join(tmpdir(), "togetherlink-droid-home-"));
    cleanup.push(home);
    const settingsPath = resolveDroidSettingsPath(home, "https://api.together.ai/v1", {});
    const settings = buildDroidSettings({ selectedModel: resolveCodexModel(KIMI_K3.id) });

    await writeDroidSettings(settingsPath, settings);

    const source = await readFile(settingsPath, "utf8");
    expect(settingsPath).toContain(join(home, ".togetherlink", "droid", "settings-"));
    expect(source).toContain("${TOGETHER_API_KEY}");
    expect(source).not.toContain("together-secret");
    if (process.platform !== "win32") {
      expect((await stat(settingsPath)).mode & 0o777).toBe(0o600);
    }
  });

  test("preserves Factory auth home while pinning runtime settings and model", () => {
    const launch = buildDroidLaunchSpec({
      selectedModel: resolveCodexModel(KIMI_K3.id),
      apiKey: "together-secret",
      settingsPath: "/tmp/togetherlink-droid-settings.json",
      passthrough: [
        "--settings",
        "/tmp/user-settings.json",
        "exec",
        "--model=other-model",
        "--auto",
        "low",
        "review this repo",
      ],
      env: { HOME: "/users/example", PATH: "/usr/bin", FACTORY_API_KEY: "factory-token" },
    });

    expect(launch).toEqual({
      binary: "droid",
      args: [
        "--settings",
        "/tmp/togetherlink-droid-settings.json",
        "exec",
        "--auto",
        "low",
        "review this repo",
      ],
      env: {
        HOME: "/users/example",
        PATH: "/usr/bin",
        FACTORY_API_KEY: "factory-token",
        TOGETHER_API_KEY: "together-secret",
      },
    });
  });

  test("preserves prompt-like flags after Droid's passthrough separator", () => {
    const launch = buildDroidLaunchSpec({
      selectedModel: resolveCodexModel(KIMI_K3.id),
      apiKey: "together-secret",
      settingsPath: "/tmp/settings.json",
      passthrough: ["--model", "ignored", "--", "--model", "literal prompt"],
      env: {},
    });

    const separatorIndex = launch.args.indexOf("--");
    expect(launch.args.slice(separatorIndex + 1)).toEqual(["--model", "literal prompt"]);
    expect(launch.args).not.toContain("ignored");
  });
});
