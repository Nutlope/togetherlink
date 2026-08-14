import { describe, expect, test } from "vitest";
import { summarizeCliUsage, versionStatus } from "../../../site/convex/cliUsageActivity.js";

describe("CLI usage activity", () => {
  test("classifies release adoption without treating newer builds as outdated", () => {
    expect(versionStatus("0.7.14", "0.7.14")).toBe("latest");
    expect(versionStatus("0.7.14-dev.1", "0.7.14")).toBe("newer");
    expect(versionStatus("0.7.15", "0.7.14")).toBe("newer");
    expect(versionStatus("0.7.8-geyser.1", "0.7.14")).toBe("outdated");
    expect(versionStatus(undefined, "0.7.14")).toBe("unknown");
  });

  test("groups CLI starts by latest user version and all harness launches", () => {
    const summary = summarizeCliUsage(
      [
        {
          installId: "user-a",
          eventType: "cli_started",
          cliVersion: "0.7.13",
          agent: "codex",
          receivedAt: 100,
        },
        {
          installId: "user-a",
          eventType: "cli_started",
          cliVersion: "0.7.14",
          agent: "claude",
          receivedAt: 200,
        },
        {
          installId: "user-b",
          eventType: "cli_started",
          cliVersion: "0.7.13",
          agent: "codex-app",
          receivedAt: 300,
        },
        {
          installId: "user-c",
          eventType: "cli_started",
          cliVersion: "0.7.15",
          agent: "claude",
          receivedAt: 400,
        },
      ],
      "0.7.14",
    );

    expect(summary).toMatchObject({
      totalLaunches: 4,
      uniqueUsers: 3,
      adoption: { latest: 1, newer: 1, outdated: 1, unknown: 0 },
      harnessUsage: [
        { agent: "claude", launches: 2, users: 2 },
        { agent: "chatgpt", launches: 1, users: 1 },
        { agent: "codex", launches: 1, users: 1 },
      ],
    });
    expect(summary.versionUsage).toEqual([
      { version: "0.7.13", status: "outdated", users: 1, launches: 2 },
      { version: "0.7.14", status: "latest", users: 1, launches: 1 },
      { version: "0.7.15", status: "newer", users: 1, launches: 1 },
    ]);
  });

  test("deduplicates model sessions and exposes unknown model coverage", () => {
    const summary = summarizeCliUsage(
      [
        {
          installId: "user-a",
          sessionId: "session-a",
          eventType: "session_started",
          agent: "codex",
          initialModel: "moonshotai/Kimi-K2.5",
          receivedAt: 100,
        },
        {
          installId: "user-a",
          sessionId: "session-a",
          eventType: "session_started",
          agent: "codex",
          receivedAt: 101,
        },
        {
          installId: "user-b",
          sessionId: "session-b",
          eventType: "session_started",
          agent: "pi",
          receivedAt: 200,
        },
      ],
      "0.7.14",
    );

    expect(summary.modelSessions).toBe(2);
    expect(summary.knownModelSessions).toBe(1);
    expect(summary.modelUsage).toEqual([
      { model: "moonshotai/Kimi-K2.5", sessions: 1, users: 1 },
      { model: "unknown", sessions: 1, users: 1 },
    ]);
  });
});
