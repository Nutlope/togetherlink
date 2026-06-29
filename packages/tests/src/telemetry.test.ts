import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendTelemetryEvent } from "../../cli/src/lib/telemetry.js";

describe("telemetry", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "togetherlink-telemetry-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("does not send analytics or create install state in GitHub Actions", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GITHUB_ACTIONS", "true");

    await sendTelemetryEvent({ event: "cli_started", agent: "codex" }, tmpDir);

    expect(fetchMock).not.toHaveBeenCalled();
    await expect(readFile(path.join(tmpDir, ".togetherlink", "install-id"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
