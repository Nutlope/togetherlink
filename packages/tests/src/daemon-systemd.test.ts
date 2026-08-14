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
  generateSystemdUnit,
  installSystemdService,
  isLinux,
  systemdServicePath,
  systemdStatus,
} from "../../cli/src/lib/daemon/systemd.js";

describe("systemd unit generation", () => {
  const tempHome = path.join(realpathSync(os.tmpdir()), `togetherlink-systemd-test-${process.pid}`);
  const togetherlinkHome = path.join(tempHome, ".togetherlink");
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  const originalArgv = [...process.argv];

  beforeEach(async () => {
    await mkdir(tempHome, { recursive: true });
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("TOGETHERLINK_HOME", togetherlinkHome);
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
    childProcess.execFile.mockReset();
    takeover.stop.mockReset();
    takeover.stop.mockResolvedValue({ stopped: false });
    takeover.wait.mockReset();
    takeover.wait.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    process.argv.splice(0, process.argv.length, ...originalArgv);
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
    vi.unstubAllEnvs();
    await rm(tempHome, { recursive: true, force: true });
  });

  test("unit pins the current Bun runtime instead of relying on systemd PATH", () => {
    const runtime = path.join(tempHome, "mise", "installs", "bun", "bin", "bun");
    const unit = generateSystemdUnit({ runtime });
    expect(unit).toContain("[Unit]");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("[Install]");
    expect(unit).toContain(
      `ExecStart="${runtime}" "${togetherlinkHome}/bin/togetherlink.js" daemon serve`,
    );
    expect(unit).not.toContain(`ExecStart="${togetherlinkHome}/bin/togetherlink"`);
    expect(unit).toContain("Restart=always");
    expect(unit).not.toContain("Restart=on-failure");
    expect(unit).toContain("RestartSec=10");
    expect(unit).toContain("WantedBy=default.target");
    expect(unit).toContain(`Environment=TOGETHERLINK_HOME=${togetherlinkHome}`);
    expect(unit).toContain("Environment=TOGETHERLINK_SUPERVISED=1");
  });

  test("unit does not include temp agent paths in PATH", () => {
    const unit = generateSystemdUnit();
    expect(unit).not.toContain("/codex-runtimes/");
    expect(unit).toContain("/usr/bin");
    expect(unit).toContain("/usr/local/bin");
  });

  test("systemdServicePath points to user config dir", () => {
    expect(systemdServicePath()).toBe(
      path.join(os.homedir(), ".config", "systemd", "user", "togetherlink-daemon.service"),
    );
  });

  test("does not leave a service file when the systemd user session is unavailable", async () => {
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
      ) => {
        const error = Object.assign(new Error("systemctl not found"), { code: "ENOENT" });
        callback(error, "", "");
      },
    );

    await expect(installSystemdService()).resolves.toMatchObject({
      installed: false,
      message: expect.stringMatching(/systemd user session is unavailable/i),
    });
    await expect(readFile(systemdServicePath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("ignores a stale service file when the systemd user session is unavailable", async () => {
    const service = systemdServicePath();
    await mkdir(path.dirname(service), { recursive: true });
    await writeFile(service, "[Service]\nExecStart=false\n");
    childProcess.execFile.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: { encoding: string },
        callback: (error: NodeJS.ErrnoException, stdout: string, stderr: string) => void,
      ) => {
        const error = Object.assign(new Error("Failed to connect to bus"), { code: "ENOTCONN" });
        callback(error, "", "Failed to connect to bus");
      },
    );

    await expect(systemdStatus()).resolves.toEqual({
      installed: false,
      message:
        "A systemd user session is unavailable in this Linux environment. TogetherLink will use portable process mode.",
    });
  });

  test("rolls back the service file when systemd installation fails after probing", async () => {
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
        if (args.includes("daemon-reload")) {
          callback(new Error("user manager stopped"), "", "user manager stopped");
          return;
        }
        callback(null, "", "");
      },
    );

    await expect(installSystemdService()).rejects.toThrow("user manager stopped");
    await expect(readFile(systemdServicePath(), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("isLinux reflects the current platform", () => {
    expect(isLinux()).toBe(process.platform === "linux");
  });
});
