import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { runProxiedSession } from "../../cli/src/lib/proxied-session.js";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

describe("proxied background session lifecycle", () => {
  let context: TestContext;
  let daemon: TestDaemon;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
    vi.stubEnv("TOGETHERLINK_HOME", daemon.home);
    vi.stubEnv("TOGETHERLINK_PORT", new URL(daemon.url).port);
    vi.stubEnv("TOGETHERLINK_TELEMETRY_DISABLED", "1");

    // Keep one persistent registration active so ensureDaemon reuses this
    // intentionally isolated test daemon even though Vitest is the parent
    // process rather than the CLI entrypoint that launched it.
    const seed = await fetch(`${daemon.url}/internal/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "persistent-test-seed",
        agent: "codex-app",
        apiKey: "test-key-never-sent-upstream",
        modelLabel: GLM_5_2.name,
        modelId: GLM_5_2.id,
        targetModelId: GLM_5_2.id,
        modelName: GLM_5_2.name,
        modelDefinition: GLM_5_2,
      }),
    });
    expect(seed.ok).toBe(true);
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("leaves a successful detached worker route active without the launcher pid", async () => {
    const result = await runProxiedSession({
      agent: "claude",
      apiKey: "test-key-never-sent-upstream",
      baseUrl: "https://api.together.ai/v1",
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      binary: process.execPath,
      args: [],
      buildArgs: () => ["-e", "process.exit(0)"],
      buildEnv: () => ({ ...process.env }),
      banner: () => "",
      keepaliveLabel: "test background session",
      preserveSessionAfterExit: true,
    });

    expect(result).toEqual({ status: 0, signal: null });
    const response = await fetch(`${daemon.url}/internal/sessions`);
    const body = (await response.json()) as {
      sessions?: Array<{ agent?: string; pid?: number; status?: string }>;
    };
    const background = body.sessions?.find((session) => session.agent === "claude");
    expect(background).toMatchObject({ agent: "claude", status: "running" });
    expect(background?.pid).toBeUndefined();

    const failed = await runProxiedSession({
      agent: "claude",
      apiKey: "test-key-never-sent-upstream",
      baseUrl: "https://api.together.ai/v1",
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      binary: process.execPath,
      args: [],
      buildArgs: () => ["-e", "process.exit(1)"],
      buildEnv: () => ({ ...process.env }),
      banner: () => "",
      keepaliveLabel: "test failed background session",
      preserveSessionAfterExit: true,
    });

    expect(failed).toEqual({ status: 1, signal: null });
    const afterFailure = await fetch(`${daemon.url}/internal/sessions`);
    const afterFailureBody = (await afterFailure.json()) as {
      sessions?: Array<{ agent?: string }>;
    };
    expect(afterFailureBody.sessions?.filter((session) => session.agent === "claude")).toHaveLength(
      1,
    );
  });
});
