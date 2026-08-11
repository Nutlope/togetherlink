import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import {
  generateLaunchdPlist,
  isMacOS,
  launchdPath,
  launchdPlistPath,
} from "../../cli/src/lib/daemon/launchd.js";

describe("launchd plist generation", () => {
  const tempHome = path.join(os.tmpdir(), `togetherlink-launchd-test-${process.pid}`);

  beforeEach(async () => {
    await mkdir(tempHome, { recursive: true });
    vi.stubEnv("TOGETHERLINK_HOME", tempHome);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tempHome, { recursive: true, force: true });
  });

  test("plist uses the installed bundle executable and includes required keys", () => {
    const plist = generateLaunchdPlist();
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("com.togetherlink.daemon");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("<true/>");
    expect(plist).toContain("<key>EnvironmentVariables</key>");
    expect(plist).toContain("<key>TOGETHERLINK_SUPERVISED</key>");
    expect(plist).toContain("<string>1</string>");
    expect(plist).toContain(`<string>${tempHome}</string>`);
    expect(plist).toContain(`${tempHome}/bin/togetherlink`);
    expect(plist).toContain("daemon</string>");
    expect(plist).toContain("serve</string>");
  });

  test("plist escapes XML special characters", () => {
    const home = path.join(tempHome, "<special&>");
    const program = path.join(home, "bin", "togetherlink");
    const plist = generateLaunchdPlist({ home, program });
    expect(plist).not.toContain("<special&>");
    expect(plist).toContain("&lt;special&amp;&gt;");
  });

  test("launchdPath includes bun and standard bin directories", () => {
    const p = launchdPath();
    expect(p).toContain(path.join(os.homedir(), ".bun", "bin"));
    expect(p).toContain("/usr/local/bin");
    expect(p).toContain("/usr/bin");
  });

  test("launchdPlistPath points to the user's LaunchAgents directory", () => {
    expect(launchdPlistPath()).toBe(
      path.join(os.homedir(), "Library", "LaunchAgents", "com.togetherlink.daemon.plist"),
    );
  });

  test("isMacOS reflects the current platform", () => {
    expect(isMacOS()).toBe(process.platform === "darwin");
  });
});
