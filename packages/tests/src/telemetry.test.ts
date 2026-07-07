import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  emitContextTrimAlarm,
  parseTogetherContextLengthInputTokens,
} from "../../cli/src/lib/context-fit.js";
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
    await expect(
      readFile(path.join(tmpDir, ".togetherlink", "install-id"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("context_trim telemetry event is POSTed with the structured trim payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GITHUB_ACTIONS", "false");

    await sendTelemetryEvent(
      {
        event: "context_trim",
        contextTrim: {
          path: "preemptive",
          model: "zai-org/GLM-5.2",
          trimmedChars: 4096,
          inputTokens: 200000,
          contextWindow: 262144,
        },
      },
      tmpDir,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/telemetry$/);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.event).toBe("context_trim");
    expect(body.contextTrim).toEqual({
      path: "preemptive",
      model: "zai-org/GLM-5.2",
      trimmedChars: 4096,
      inputTokens: 200000,
      contextWindow: 262144,
    });
    // Anonymous install id is attached, no device fingerprint.
    expect(typeof body.installId).toBe("string");
    expect(body.installId.length).toBeGreaterThan(0);
  });
});

describe("context trim alarm (telemetry + stderr)", () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("writes an always-on stderr warning and fires a context_trim telemetry event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GITHUB_ACTIONS", "false");

    emitContextTrimAlarm({
      path: "retry",
      model: "moonshotai/Kimi-K2.7-Code",
      trimmedChars: 9001,
      inputTokens:
        parseTogetherContextLengthInputTokens(
          "maximum context length is 262,144 tokens. (258_001 input tokens, 2048 output tokens).",
        ) ?? 0,
      contextWindow: 262144,
    });

    // The stderr warning is always-on (not debug-gated) and single-line.
    const written = stderrWrite.mock.calls.map((c: unknown[]) => String(c[0])).join("");
    expect(written).toContain("togetherlink: trimmed 9001 chars");
    expect(written).toContain("moonshotai/Kimi-K2.7-Code");
    expect(written).toContain("(retry path)");
    expect(written).toContain("if you see this often, report it");

    // Telemetry is fire-and-forget but still flushes within the timeout.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.event).toBe("context_trim");
    expect(body.contextTrim).toEqual({
      path: "retry",
      model: "moonshotai/Kimi-K2.7-Code",
      trimmedChars: 9001,
      inputTokens: 258001,
      contextWindow: 262144,
    });
  });
});
