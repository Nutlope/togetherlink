import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { runTrackedSpawnedSession } from "../../cli/src/lib/spawned-session.js";

describe("spawned session telemetry", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "togetherlink-spawned-session-"));
    vi.stubEnv("GITHUB_ACTIONS", "false");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("records start and end lifecycle events for direct harnesses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTrackedSpawnedSession({
      agent: "opencode",
      modelId: "zai-org/GLM-5.2",
      binary: process.execPath,
      args: ["-e", "process.exit(0)"],
      options: { stdio: "ignore" },
      home: tmpDir,
    });

    expect(result).toEqual({ status: 0, signal: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const events = fetchMock.mock.calls.map((call) =>
      JSON.parse(((call[1] as RequestInit).body as string) ?? "{}"),
    );
    expect(events.map((event) => event.event)).toEqual(["session_started", "session_ended"]);
    expect(events[0].sessionId).toBe(events[1].sessionId);
    expect(events[1]).toMatchObject({
      agent: "opencode",
      initialModel: "zai-org/GLM-5.2",
      finalModel: "zai-org/GLM-5.2",
      exitCode: 0,
      metadata: { usageTracking: "lifecycle_only" },
    });
  });
});
