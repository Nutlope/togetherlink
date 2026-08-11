import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import {
  generateSystemdUnit,
  isLinux,
  systemdServicePath,
} from "../../cli/src/lib/daemon/systemd.js";

describe("systemd unit generation", () => {
  const tempHome = path.join(os.tmpdir(), `togetherlink-systemd-test-${process.pid}`);

  beforeEach(async () => {
    await mkdir(tempHome, { recursive: true });
    vi.stubEnv("TOGETHERLINK_HOME", tempHome);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tempHome, { recursive: true, force: true });
  });

  test("unit uses the installed bundle executable and required sections", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain("[Unit]");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("[Install]");
    expect(unit).toContain(`ExecStart=${tempHome}/bin/togetherlink daemon serve`);
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain("RestartSec=10");
    expect(unit).toContain("WantedBy=default.target");
    expect(unit).toContain(`Environment=TOGETHERLINK_HOME=${tempHome}`);
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

  test("isLinux reflects the current platform", () => {
    expect(isLinux()).toBe(process.platform === "linux");
  });
});
