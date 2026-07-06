import { describe, expect, test } from "vitest";
import { togetherlinkHome, isProcessAlive } from "@togetherlink/cli/dist/lib/paths.js";

describe("paths.ts — single source of truth for home + liveness (#7)", () => {
  test("togetherlinkHome honors TOGETHERLINK_HOME env", () => {
    const original = process.env.TOGETHERLINK_HOME;
    process.env.TOGETHERLINK_HOME = "/tmp/togetherlink-test-home-xyz";
    try {
      expect(togetherlinkHome()).toBe("/tmp/togetherlink-test-home-xyz");
    } finally {
      if (original === undefined) delete process.env.TOGETHERLINK_HOME;
      else process.env.TOGETHERLINK_HOME = original;
    }
  });

  test("togetherlinkHome falls back to ~/.togetherlink when env unset", () => {
    const original = process.env.TOGETHERLINK_HOME;
    delete process.env.TOGETHERLINK_HOME;
    try {
      const home = togetherlinkHome();
      expect(home.endsWith("/.togetherlink")).toBe(true);
    } finally {
      if (original !== undefined) process.env.TOGETHERLINK_HOME = original;
    }
  });

  test("isProcessAlive returns false for a dead pid (ESRCH)", () => {
    // pid 0 is never a valid kill target on unix; use a very large unused pid.
    expect(isProcessAlive(999_999_999)).toBe(false);
  });

  test("isProcessAlive returns true for the current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });
});
