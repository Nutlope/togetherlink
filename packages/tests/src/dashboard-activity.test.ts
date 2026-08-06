import { describe, expect, test } from "vitest";
import {
  groupActiveInstallsByLatestCountry,
  summarizeLifecycleActivity,
} from "../../../site/convex/dashboardActivity.js";

describe("dashboard lifecycle activity", () => {
  test("deduplicates sessions and separates tracked from lifecycle-only harnesses", () => {
    const events = [
      {
        installId: "install-a",
        sessionId: "session-1",
        eventType: "session_started",
        agent: "claude",
        receivedAt: 100,
      },
      {
        installId: "install-a",
        sessionId: "session-1",
        eventType: "session_started",
        agent: "claude",
        receivedAt: 101,
      },
      {
        installId: "install-a",
        sessionId: "session-1",
        eventType: "session_ended",
        agent: "claude",
        receivedAt: 200,
        costUsd: 0.25,
      },
      {
        installId: "install-a",
        sessionId: "session-2",
        eventType: "session_started",
        agent: "pi",
        receivedAt: 300,
      },
      {
        installId: "install-a",
        sessionId: "session-2",
        eventType: "session_ended",
        agent: "pi",
        receivedAt: 400,
      },
      {
        installId: "install-b",
        eventType: "cli_started",
        agent: "grok",
        receivedAt: 500,
      },
    ];

    const summary = summarizeLifecycleActivity(events, {
      bucketKey: (timestampMs) => (timestampMs < 250 ? "day-1" : "day-2"),
    });

    expect(summary.activeInstalls).toBe(1);
    expect(summary.sessions).toBe(2);
    expect(summary.repeatInstalls).toBe(1);
    expect(summary.trackedSessions).toBe(1);
    expect(summary.untrackedSessions).toBe(1);
    expect(summary.activeInstallsByBucket).toEqual([
      { day: "day-1", count: 1 },
      { day: "day-2", count: 1 },
    ]);
    expect(summary.sessionsByBucket).toEqual([
      { day: "day-1", count: 1 },
      { day: "day-2", count: 1 },
    ]);
    expect(summary.harnessUsage).toEqual([
      {
        agent: "claude",
        activeInstalls: 1,
        sessions: 1,
        repeatInstalls: 0,
        trackedSessions: 1,
        untrackedSessions: 0,
      },
      {
        agent: "pi",
        activeInstalls: 1,
        sessions: 1,
        repeatInstalls: 0,
        trackedSessions: 0,
        untrackedSessions: 1,
      },
    ]);
  });

  test("applies rolling-window cutoffs before calculating the audience", () => {
    const events = [
      {
        installId: "old-install",
        sessionId: "old-session",
        eventType: "session_started",
        receivedAt: 99,
      },
      {
        installId: "current-install",
        sessionId: "current-session",
        eventType: "session_started",
        receivedAt: 100,
      },
    ];

    expect(summarizeLifecycleActivity(events, { since: 100 })).toMatchObject({
      activeInstalls: 1,
      sessions: 1,
      repeatInstalls: 0,
    });
  });

  test("assigns every active install to exactly one latest session country", () => {
    const countries = groupActiveInstallsByLatestCountry([
      {
        installId: "install-a",
        sessionId: "session-1",
        eventType: "session_started",
        countryCode: "US",
        receivedAt: 100,
      },
      {
        installId: "install-a",
        sessionId: "session-1",
        eventType: "session_ended",
        countryCode: "CA",
        receivedAt: 200,
      },
      {
        installId: "install-b",
        eventType: "cli_started",
        countryCode: "GB",
        receivedAt: 300,
      },
      {
        installId: "install-c",
        sessionId: "session-2",
        eventType: "session_started",
        countryCode: "US",
        receivedAt: 400,
      },
    ]);

    expect(
      Array.from(countries.entries()).map(([countryCode, installIds]) => [
        countryCode,
        Array.from(installIds),
      ]),
    ).toEqual([
      ["CA", ["install-a"]],
      ["US", ["install-c"]],
    ]);
  });
});
