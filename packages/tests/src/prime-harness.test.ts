import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { KIMI_K3, SELECTABLE_MODELS } from "@togetherlink/models";
import { resolveCodexModel } from "../../cli/src/lib/codex/defaults.js";
import { HARNESS, HARNESS_BIN, HARNESS_INSTALL } from "../../cli/src/lib/harness.js";
import { loadHarness } from "../../cli/src/lib/harness-registry.js";
import {
  buildPrimeLaunchSpec,
  buildPrimeProviderConfig,
  buildPrimeProviderExtensionSource,
  PRIME_PROVIDER_ID,
  resolvePrimeProviderExtensionPath,
  writePrimeProviderExtension,
} from "../../cli/src/lib/prime/core.js";

describe("Prime Agent harness", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test("registers the official binary and installer", () => {
    expect(HARNESS.PRIME).toBe("prime");
    expect(HARNESS_BIN[HARNESS.PRIME]).toBe("prime-agent");
    expect(HARNESS_INSTALL[HARNESS.PRIME]).toEqual({
      command: "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh",
      url: "https://github.com/PrimeIntellect-ai/prime-agent",
    });
  });

  test("loads the Prime adapter through the harness registry", async () => {
    await expect(loadHarness(HARNESS.PRIME)).resolves.toMatchObject({
      id: "prime",
      label: "Prime Agent",
    });
  });

  test("maps the curated Together catalog to Prime's OpenAI-compatible provider", () => {
    const provider = buildPrimeProviderConfig("http://127.0.0.1:1234/together/v1");

    expect(provider).toMatchObject({
      name: "Together AI via TogetherLink",
      baseUrl: "http://127.0.0.1:1234/together/v1",
      apiKey: "TOGETHER_API_KEY",
      api: "openai-completions",
    });
    expect(provider.models).toHaveLength(SELECTABLE_MODELS.length);
    expect(provider.models.find((model) => model.id === KIMI_K3.id)).toEqual({
      id: KIMI_K3.id,
      name: `Together AI · ${KIMI_K3.name}`,
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 1_048_576,
      maxTokens: 131_072,
      cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 },
      thinkingLevelMap: {
        minimal: null,
        low: "low",
        medium: null,
        high: "high",
        xhigh: "max",
      },
    });
  });

  test("writes a credential-free extension under TogetherLink's own home", async () => {
    const home = await mkdtemp(join(tmpdir(), "togetherlink-prime-home-"));
    cleanup.push(home);
    const extensionPath = resolvePrimeProviderExtensionPath(home, {});

    await writePrimeProviderExtension(extensionPath, "https://api.together.ai/v1");

    const source = await readFile(extensionPath, "utf8");
    expect(extensionPath).toBe(join(home, ".togetherlink", "prime-agent", "together-provider.js"));
    expect(source).toBe(buildPrimeProviderExtensionSource("https://api.together.ai/v1"));
    expect(source).toContain(`pi.registerProvider("${PRIME_PROVIDER_ID}"`);
    expect(source).not.toContain("together-secret");
    if (process.platform !== "win32") {
      expect((await stat(extensionPath)).mode & 0o777).toBe(0o600);
    }
  });

  test("keeps Prime features while pinning provider, model, scope, and runtime key", () => {
    const launch = buildPrimeLaunchSpec({
      selectedModel: resolveCodexModel(KIMI_K3.id),
      apiKey: "together-secret",
      baseUrl: "https://api.together.ai/v1",
      extensionPath: "/tmp/together-provider.js",
      passthrough: [
        "--provider",
        "openai",
        "--model=other/model",
        "--models",
        "other/*",
        "--api-key",
        "other-secret",
        "--extension",
        "/tmp/user-extension.ts",
        "--autonomous",
      ],
      env: { PATH: "/usr/bin", TOGETHER_API_KEY: "inherited-key" },
    });

    expect(launch.binary).toBe("prime-agent");
    expect(launch.args.slice(0, 8)).toEqual([
      "--extension",
      "/tmp/together-provider.js",
      "--provider",
      "togetherlink",
      "--model",
      KIMI_K3.id,
      "--models",
      SELECTABLE_MODELS.map((model) => `togetherlink/${model.id}`).join(","),
    ]);
    expect(launch.args).toContain("together-secret");
    expect(launch.args).toContain("/tmp/user-extension.ts");
    expect(launch.args).toContain("--autonomous");
    expect(launch.args).not.toContain("other/model");
    expect(launch.args).not.toContain("other/*");
    expect(launch.args).not.toContain("other-secret");
    expect(launch.env).toEqual({
      PATH: "/usr/bin",
      TOGETHER_API_KEY: "together-secret",
      TOGETHER_BASE_URL: "https://api.together.ai/v1",
    });
  });

  test("honors an isolated TogetherLink home without changing Prime's home", () => {
    expect(
      resolvePrimeProviderExtensionPath("/users/example", {
        TOGETHERLINK_HOME: "/tmp/togetherlink-isolated",
        PRIME_AGENT_CODING_AGENT_DIR: "/users/example/.prime/agent",
      }),
    ).toBe("/tmp/togetherlink-isolated/prime-agent/together-provider.js");
  });
});
