import { mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildHermesLaunchSpec,
  createHermesHomeOverlay,
  resolveHermesCommand,
} from "../../cli/src/lib/hermes/core.js";
import { resolveHarnessInvocation } from "../../cli/src/lib/commands/harness-invocation.js";
import { parseArgs } from "../../cli/src/lib/parse-args.js";

describe("Hermes harnesses", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const directory of cleanup.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("recognizes Hermes Desktop as the nested hermes desktop command", () => {
    const parsed = parseArgs(["hermes", "desktop", "--cwd", "/tmp/project"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("hermes");
    expect(invocation.flags.passthrough).toEqual(["desktop", "--cwd", "/tmp/project"]);
    expect(resolveHermesCommand(invocation.flags.passthrough ?? [])).toEqual({
      mode: "desktop",
      passthrough: ["--cwd", "/tmp/project"],
    });
  });

  test("keeps ordinary Hermes arguments in terminal mode", () => {
    expect(resolveHermesCommand(["--oneshot", "say hi"])).toEqual({
      mode: "terminal",
      passthrough: ["--oneshot", "say hi"],
    });
  });

  test("launches terminal Hermes through the ephemeral provider contract", () => {
    const launch = buildHermesLaunchSpec({
      mode: "terminal",
      modelId: "moonshotai/Kimi-K2.5",
      apiKey: "together-secret",
      baseUrl: "https://api.together.ai/v1",
      hermesHome: "/tmp/togetherlink-hermes",
      passthrough: ["--provider", "openrouter", "--model=other/model", "--oneshot", "say hi"],
      env: { PATH: "/usr/bin" },
    });

    expect(launch).toEqual({
      binary: "hermes",
      args: [
        "--provider",
        "togetherlink",
        "--model",
        "moonshotai/Kimi-K2.5",
        "--oneshot",
        "say hi",
      ],
      env: {
        PATH: "/usr/bin",
        TOGETHER_API_KEY: "together-secret",
        TOGETHER_BASE_URL: "https://api.together.ai/v1",
        TOGETHERLINK_HERMES_API_KEY: "together-secret",
        TOGETHERLINK_HERMES_BASE_URL: "https://api.together.ai/v1",
        HERMES_MODEL: "moonshotai/Kimi-K2.5",
        HERMES_INFERENCE_MODEL: "moonshotai/Kimi-K2.5",
        HERMES_INFERENCE_PROVIDER: "togetherlink",
        HERMES_TUI_PROVIDER: "togetherlink",
        HERMES_HOME: "/tmp/togetherlink-hermes",
      },
    });
  });

  test("launches Hermes Desktop with the same ephemeral Together runtime", () => {
    const launch = buildHermesLaunchSpec({
      mode: "desktop",
      modelId: "moonshotai/Kimi-K2.5",
      apiKey: "together-secret",
      baseUrl: "https://api.together.ai/v1",
      hermesHome: "/tmp/togetherlink-hermes",
      passthrough: ["--skip-build", "--cwd", "/tmp/project"],
      env: { PATH: "/usr/bin" },
    });

    expect(launch).toEqual({
      binary: "hermes",
      args: ["desktop", "--skip-build", "--cwd", "/tmp/project"],
      env: {
        PATH: "/usr/bin",
        TOGETHER_API_KEY: "together-secret",
        TOGETHER_BASE_URL: "https://api.together.ai/v1",
        TOGETHERLINK_HERMES_API_KEY: "together-secret",
        TOGETHERLINK_HERMES_BASE_URL: "https://api.together.ai/v1",
        HERMES_MODEL: "moonshotai/Kimi-K2.5",
        HERMES_INFERENCE_MODEL: "moonshotai/Kimi-K2.5",
        HERMES_INFERENCE_PROVIDER: "togetherlink",
        HERMES_TUI_PROVIDER: "togetherlink",
        HERMES_HOME: "/tmp/togetherlink-hermes",
      },
    });
  });

  test("adds the Together provider when native config has no providers map", () => {
    const nativeHome = mkdtempSync(join(tmpdir(), "hermes-native-"));
    cleanup.push(nativeHome);
    writeFileSync(join(nativeHome, "config.yaml"), "display:\n  interface: cli\n", "utf8");

    const overlay = createHermesHomeOverlay(nativeHome, {
      baseUrl: "https://api.together.ai/v1",
      modelIds: ["moonshotai/Kimi-K3"],
    });
    cleanup.push(overlay);

    const overlayConfig = readFileSync(join(overlay, "config.yaml"), "utf8");
    expect(overlayConfig).toContain("providers:");
    expect(overlayConfig).toContain("togetherlink:");
    expect(overlayConfig).toContain("default_model: moonshotai/Kimi-K3");
  });

  test("isolates Hermes credentials while preserving native session and config state", () => {
    const nativeHome = mkdtempSync(join(tmpdir(), "hermes-native-"));
    cleanup.push(nativeHome);
    mkdirSync(join(nativeHome, "sessions"));
    mkdirSync(join(nativeHome, "plugins", "model-providers", "togetherlink"), {
      recursive: true,
    });
    writeFileSync(
      join(nativeHome, "config.yaml"),
      "display:\n  interface: tui\nproviders:\n  native-provider:\n    base_url: https://native.example/v1\n",
      "utf8",
    );
    writeFileSync(join(nativeHome, "auth.json"), "secret", "utf8");
    writeFileSync(
      join(nativeHome, ".env"),
      "TOGETHER_API_KEY=old-secret\nOPENROUTER_API_KEY=secret\n",
      "utf8",
    );
    writeFileSync(
      join(nativeHome, "plugins", "model-providers", "togetherlink", "__init__.py"),
      "# user-owned plugin\n",
      "utf8",
    );

    const overlay = createHermesHomeOverlay(nativeHome, {
      baseUrl: "https://api.together.ai/v1",
      modelIds: ["moonshotai/Kimi-K2.5", "zai-org/GLM-5"],
    });
    cleanup.push(overlay);

    expect(readlinkSync(join(overlay, "sessions"))).toBe(join(nativeHome, "sessions"));
    const overlayConfig = readFileSync(join(overlay, "config.yaml"), "utf8");
    expect(overlayConfig).toContain("native-provider");
    expect(overlayConfig).toContain("togetherlink");
    expect(overlayConfig).toContain("key_env: TOGETHERLINK_HERMES_API_KEY");
    expect(overlayConfig).toContain("transport: chat_completions");
    expect(overlayConfig).toContain("moonshotai/Kimi-K2.5");
    expect(overlayConfig).toContain("zai-org/GLM-5");
    writeFileSync(join(overlay, "config.yaml"), "model:\n  provider: togetherlink\n", "utf8");
    expect(readFileSync(join(nativeHome, "config.yaml"), "utf8")).toBe(
      "display:\n  interface: tui\nproviders:\n  native-provider:\n    base_url: https://native.example/v1\n",
    );
    expect(() => readlinkSync(join(overlay, "auth.json"))).toThrow();
    expect(() => readFileSync(join(overlay, ".env"), "utf8")).toThrow();
    expect(readFileSync(join(nativeHome, ".env"), "utf8")).toBe(
      "TOGETHER_API_KEY=old-secret\nOPENROUTER_API_KEY=secret\n",
    );
    expect(
      readFileSync(
        join(overlay, "plugins", "model-providers", "togetherlink", "__init__.py"),
        "utf8",
      ),
    ).toContain('fallback_models=("moonshotai/Kimi-K2.5", "zai-org/GLM-5")');
    expect(
      readFileSync(
        join(nativeHome, "plugins", "model-providers", "togetherlink", "__init__.py"),
        "utf8",
      ),
    ).toBe("# user-owned plugin\n");
  });
});
