import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const childProcess = vi.hoisted(() => ({
  execFile: vi.fn(),
}));

const takeover = vi.hoisted(() => ({
  stop: vi.fn(),
  wait: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: childProcess.execFile,
}));

vi.mock("../../cli/src/lib/daemon/takeover.js", () => ({
  stopLegacyDaemonForTakeover: takeover.stop,
  waitForManagedDaemonReady: takeover.wait,
}));

import {
  generateLaunchdPlist,
  installLaunchdDaemon,
  isMacOS,
  launchdPath,
  launchdPlistPath,
  launchdStatus,
} from "../../cli/src/lib/daemon/launchd.js";

describe("launchd plist generation", () => {
  const tempHome = path.join(realpathSync(os.tmpdir()), `togetherlink-launchd-test-${process.pid}`);
  const togetherlinkHome = path.join(tempHome, ".togetherlink");
  const originalArgv = [...process.argv];
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

  beforeEach(async () => {
    Object.defineProperty(process, "platform", {
      ...originalPlatform,
      value: "darwin",
    });
    await mkdir(tempHome, { recursive: true });
    vi.spyOn(os, "homedir").mockReturnValue(tempHome);
    vi.stubEnv("TOGETHERLINK_HOME", togetherlinkHome);
    childProcess.execFile.mockReset();
    takeover.stop.mockReset();
    takeover.stop.mockResolvedValue({ stopped: false });
    takeover.wait.mockReset();
    takeover.wait.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    process.argv.splice(0, process.argv.length, ...originalArgv);
    if (originalPlatform) Object.defineProperty(process, "platform", originalPlatform);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(tempHome, { recursive: true, force: true });
  });

  test("plist pins the current Bun runtime instead of relying on launchd PATH", () => {
    const runtime = path.join(tempHome, "mise", "installs", "bun", "bin", "bun");
    const plist = generateLaunchdPlist({ runtime });
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("com.togetherlink.daemon");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<key>KeepAlive</key>\n  <true/>");
    expect(plist).not.toContain("<key>SuccessfulExit</key>");
    expect(plist).toContain("<key>EnvironmentVariables</key>");
    expect(plist).toContain("<key>TOGETHERLINK_SUPERVISED</key>");
    expect(plist).toContain("<string>1</string>");
    expect(plist).toContain(`<string>${togetherlinkHome}</string>`);
    expect(plist).toContain(`<string>${runtime}</string>`);
    expect(plist).toContain(`<string>${togetherlinkHome}/bin/togetherlink.js</string>`);
    expect(plist).not.toContain(`<string>${togetherlinkHome}/bin/togetherlink</string>`);
    expect(plist).toContain("daemon</string>");
    expect(plist).toContain("serve</string>");
  });

  test("plist escapes XML special characters", () => {
    const home = path.join(tempHome, "<special&>");
    const runtime = path.join(home, "mise", "bun");
    const bundle = path.join(home, "bin", "togetherlink.js");
    const plist = generateLaunchdPlist({ home, runtime, bundle });
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

  test("does not leave a plist when the launchd user session is unavailable", async () => {
    const bundle = path.join(togetherlinkHome, "bin", "togetherlink.js");
    await mkdir(path.dirname(bundle), { recursive: true });
    await writeFile(bundle, "// test bundle\n");
    process.argv[1] = bundle;
    childProcess.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { encoding: string },
        callback: (error: NodeJS.ErrnoException, stdout: string, stderr: string) => void,
      ) => callback(new Error("Could not find domain for user"), "", ""),
    );

    await expect(installLaunchdDaemon()).resolves.toMatchObject({
      installed: false,
      message: expect.stringMatching(/launchd user session is unavailable/i),
    });
    await expect(readFile(launchdPlistPath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("probes launchd with a bounded user-domain query and timeout", async () => {
    childProcess.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { encoding: string },
        callback: (error: NodeJS.ErrnoException, stdout: string, stderr: string) => void,
      ) => callback(new Error("unavailable"), "", ""),
    );

    await launchdStatus();

    expect(childProcess.execFile).toHaveBeenCalledWith(
      "launchctl",
      ["print-disabled", expect.stringMatching(/^gui\/\d+$/)],
      expect.objectContaining({ timeout: 3_000, maxBuffer: 256 * 1024 }),
      expect.any(Function),
    );
  });

  test("ignores a stale plist when the launchd user session is unavailable", async () => {
    const plist = launchdPlistPath();
    await mkdir(path.dirname(plist), { recursive: true });
    await writeFile(plist, "stale plist\n");
    childProcess.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { encoding: string },
        callback: (error: NodeJS.ErrnoException, stdout: string, stderr: string) => void,
      ) => callback(new Error("Could not find domain for user"), "", ""),
    );

    await expect(launchdStatus()).resolves.toEqual({
      installed: false,
      message:
        "A launchd user session is unavailable in this macOS environment. TogetherLink will use portable process mode.",
    });
  });

  test("rolls back the plist when launchd installation fails after probing", async () => {
    const bundle = path.join(togetherlinkHome, "bin", "togetherlink.js");
    await mkdir(path.dirname(bundle), { recursive: true });
    await writeFile(bundle, "// test bundle\n");
    process.argv[1] = bundle;
    childProcess.execFile.mockImplementation(
      (
        _file: string,
        args: string[],
        _options: { encoding: string },
        callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
      ) => {
        if (args.includes("bootstrap")) {
          callback(new Error("launchd session ended"), "", "launchd session ended");
          return;
        }
        callback(null, "", "");
      },
    );

    await expect(installLaunchdDaemon()).rejects.toThrow("launchd session ended");
    await expect(readFile(launchdPlistPath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("isMacOS reflects the current platform", () => {
    expect(isMacOS()).toBe(process.platform === "darwin");
  });
});
