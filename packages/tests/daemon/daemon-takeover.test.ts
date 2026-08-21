import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { rm } from "node:fs/promises";
import { stopLegacyDaemonForTakeover } from "../../cli/src/lib/daemon/takeover.js";
import { healthyPortRaceExitCode } from "../../cli/src/lib/daemon/server.js";
import { cleanupTmpDir, createTestContext } from "../src/context.js";
import { startTestDaemon } from "../src/daemon-session.js";
import type { TestContext } from "../src/types.js";

describe("supervised daemon takeover", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await cleanupTmpDir(context);
  });

  test("stops the healthy legacy daemon before the OS supervisor starts", async () => {
    const daemon = await startTestDaemon(context);
    const health = (await fetch(`${daemon.url}/healthz`).then((response) => response.json())) as {
      pid: number;
    };
    vi.stubEnv("TOGETHERLINK_HOME", daemon.home);
    vi.stubEnv("TOGETHERLINK_PORT", new URL(daemon.url).port);

    await expect(stopLegacyDaemonForTakeover()).resolves.toEqual({
      stopped: true,
      pid: health.pid,
    });
    await expect(fetch(`${daemon.url}/healthz`)).rejects.toThrow();

    await rm(daemon.home, { recursive: true, force: true });
  });

  test("makes a supervised port race retryable while detached races still exit cleanly", () => {
    vi.stubEnv("TOGETHERLINK_SUPERVISED", "1");
    expect(healthyPortRaceExitCode()).toBe(1);

    vi.stubEnv("TOGETHERLINK_SUPERVISED", "0");
    expect(healthyPortRaceExitCode()).toBe(0);
  });
});
