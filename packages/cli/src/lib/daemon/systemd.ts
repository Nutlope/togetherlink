import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { togetherlinkHome } from "../paths.js";
import { runningFromBundle } from "./detect-bundle.js";
import { stopLegacyDaemonForTakeover, waitForManagedDaemonReady } from "./takeover.js";

const AUTO_INSTALL_SENTINEL = "systemd-supervision-v4-installed";
const PREVIOUS_AUTO_INSTALL_SENTINELS = [
  "systemd-supervision-v3-installed",
  "systemd-supervision-v2-installed",
];
const LEGACY_AUTO_INSTALL_SENTINEL = "systemd-auto-installed";
const SYSTEMD_SERVICE_NAME = "togetherlink-daemon.service";

export function isLinux(): boolean {
  return process.platform === "linux";
}

function assertLinux(): void {
  if (!isLinux()) {
    throw new Error("systemd user services are only supported on Linux.");
  }
}

function autoInstallSentinelPath(): string {
  return path.join(togetherlinkHome(), AUTO_INSTALL_SENTINEL);
}

function systemdUserDir(): string {
  return path.join(os.homedir(), ".config", "systemd", "user");
}

function servicePath(): string {
  return path.join(systemdUserDir(), SYSTEMD_SERVICE_NAME);
}

function bundleExecutable(): string {
  return path.join(togetherlinkHome(), "bin", "togetherlink");
}

function bundleScript(home = togetherlinkHome()): string {
  return path.join(home, "bin", "togetherlink.js");
}

function isInsideSystemdJob(): boolean {
  return (
    process.env.SYSTEMD_EXEC_PID !== undefined ||
    process.env.LD_PRELOAD?.includes("libsystemd") === true
  );
}

function systemdPath(): string {
  const home = os.homedir();
  return [
    path.join(home, ".bun", "bin"),
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/usr/sbin",
    "/bin",
    "/sbin",
  ].join(":");
}

export function generateSystemdUnit(overrides?: {
  runtime?: string;
  bundle?: string;
  home?: string;
}): string {
  const home = overrides?.home ?? togetherlinkHome();
  const runtime = overrides?.runtime ?? process.execPath;
  const bundle = overrides?.bundle ?? bundleScript(home);
  const logDir = path.join(home, "logs");
  return [
    "[Unit]",
    "Description=TogetherLink shared proxy daemon",
    "After=network.target",
    "",
    "[Service]",
    `Environment=TOGETHERLINK_HOME=${home}`,
    "Environment=TOGETHERLINK_SUPERVISED=1",
    `Environment=PATH=${systemdPath()}`,
    // Pin the runtime that is successfully executing the installed CLI now;
    // systemd does not inherit shell version-manager PATH configuration.
    `ExecStart="${runtime}" "${bundle}" daemon serve`,
    // systemctl stop suppresses restart, but every process exit (including 0)
    // must recover the proxy automatically.
    "Restart=always",
    "RestartSec=10",
    `StandardOutput=append:${path.join(logDir, "daemon.log")}`,
    `StandardError=append:${path.join(logDir, "daemon.log")}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

function promisifiedExecFile(
  file: string,
  args: string[],
  options: { timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: "utf8", ...options }, (err, stdout, stderr) => {
      if (err) {
        Object.assign(err, { stdout, stderr });
        reject(err as Error & { stdout: string; stderr: string });
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Linux does not imply a usable systemd user manager. Containers, CI workers,
 * devcontainers, WSL sessions, and minimal distributions may have no
 * `systemctl` binary or no user bus. Probe the capability before creating any
 * service files or stopping an existing daemon.
 */
async function systemdUserSessionAvailable(): Promise<boolean> {
  try {
    await promisifiedExecFile("systemctl", ["--user", "show-environment"], { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

async function rollbackSystemdService(svcPath: string): Promise<void> {
  for (const args of [
    ["--user", "stop", SYSTEMD_SERVICE_NAME],
    ["--user", "disable", SYSTEMD_SERVICE_NAME],
  ]) {
    try {
      await promisifiedExecFile("systemctl", args);
    } catch {
      // Best effort: the user manager may have disappeared after the probe.
    }
  }
  try {
    await unlink(svcPath);
  } catch {
    // The service file may already have been removed externally.
  }
  try {
    await promisifiedExecFile("systemctl", ["--user", "daemon-reload"]);
  } catch {
    // Nothing else can be cleaned up without a usable user manager.
  }
}

/**
 * One-time migration: install the systemd user service for existing Linux users
 * the first time they run the installed bundle. It is silent, non-blocking,
 * and skipped when already installed or when running the daemon itself.
 */
export async function maybeAutoInstallSystemdService(): Promise<boolean> {
  if (!isLinux()) return false;
  if (isInsideSystemdJob()) return false;
  if (process.argv.includes("--daemon") || process.argv[2] === "daemon") return false;

  const sentinel = autoInstallSentinelPath();
  const already = await readFile(sentinel, "utf8")
    .then(() => true)
    .catch(() => false);
  if (already) return false;

  if (!(await runningFromBundle())) return false;

  try {
    const result = await installSystemdService();
    return result.installed;
  } catch {
    return false;
  }
}

export async function installSystemdService(): Promise<{ installed: boolean; message: string }> {
  assertLinux();
  if (!(await runningFromBundle())) {
    const argv1 = process.argv[1] ?? "unknown";
    return {
      installed: false,
      message:
        `Auto-start is only configured for the installed bundle (${bundleExecutable()}). ` +
        `This process was started from ${argv1}. Run install.sh first, then use the installed togetherlink command.`,
    };
  }

  if (!(await systemdUserSessionAvailable())) {
    return {
      installed: false,
      message:
        "A systemd user session is unavailable in this Linux environment. " +
        "TogetherLink will start its daemon automatically in portable process mode when needed.",
    };
  }

  const svcPath = servicePath();
  const svcDir = systemdUserDir();
  await mkdir(svcDir, { recursive: true });
  await mkdir(path.join(togetherlinkHome(), "logs"), { recursive: true });

  const unit = generateSystemdUnit();
  await writeFile(svcPath, unit, { mode: 0o644 });
  try {
    try {
      await promisifiedExecFile("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
    } catch {
      // The legacy daemon may not have been systemd-managed.
    }
    await stopLegacyDaemonForTakeover();
    await promisifiedExecFile("systemctl", ["--user", "daemon-reload"]);
    await promisifiedExecFile("systemctl", ["--user", "enable", SYSTEMD_SERVICE_NAME]);
    await promisifiedExecFile("systemctl", ["--user", "start", SYSTEMD_SERVICE_NAME]);
    await waitForManagedDaemonReady();
    await writeFile(autoInstallSentinelPath(), new Date().toISOString(), { mode: 0o600 });
    for (const staleSentinel of [
      ...PREVIOUS_AUTO_INSTALL_SENTINELS.map((name) => path.join(togetherlinkHome(), name)),
      path.join(togetherlinkHome(), LEGACY_AUTO_INSTALL_SENTINEL),
    ]) {
      try {
        await unlink(staleSentinel);
      } catch {
        // ignore
      }
    }
  } catch (error) {
    await rollbackSystemdService(svcPath);
    throw error;
  }

  return {
    installed: true,
    message: `Installed systemd user service: ${svcPath}\nThe TogetherLink daemon will now start at login and restart if it exits.`,
  };
}

export async function uninstallSystemdService(): Promise<{ removed: boolean; message: string }> {
  assertLinux();
  const svcPath = servicePath();

  const exists = await readFile(svcPath, "utf8")
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    return {
      removed: false,
      message: `No systemd user service found at ${svcPath}.`,
    };
  }

  if (!(await systemdUserSessionAvailable())) {
    await unlink(svcPath);
    await removeAutoInstallSentinels();
    return {
      removed: true,
      message:
        `Removed stale systemd user service: ${svcPath}\n` +
        "The systemd user session is unavailable, so no running service could be stopped.",
    };
  }

  let stopped = false;
  try {
    await promisifiedExecFile("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
    stopped = true;
  } catch (err) {
    const message = (err as Error).message ?? "";
    stopped = message.includes("not loaded") || message.includes("does not exist");
  }

  try {
    await promisifiedExecFile("systemctl", ["--user", "disable", SYSTEMD_SERVICE_NAME]);
  } catch {
    // ignore
  }

  if (!stopped) {
    return {
      removed: false,
      message:
        `Could not stop systemd service ${SYSTEMD_SERVICE_NAME}. ` +
        `Run \`systemctl --user stop '${SYSTEMD_SERVICE_NAME}'\` and remove ${svcPath} manually.`,
    };
  }

  await unlink(svcPath);
  await removeAutoInstallSentinels();

  await promisifiedExecFile("systemctl", ["--user", "daemon-reload"]);

  return {
    removed: true,
    message: `Removed systemd user service: ${svcPath}\nThe TogetherLink daemon will no longer start automatically at login.`,
  };
}

async function removeAutoInstallSentinels(): Promise<void> {
  for (const sentinel of [
    autoInstallSentinelPath(),
    ...PREVIOUS_AUTO_INSTALL_SENTINELS.map((name) => path.join(togetherlinkHome(), name)),
    path.join(togetherlinkHome(), LEGACY_AUTO_INSTALL_SENTINEL),
  ]) {
    try {
      await unlink(sentinel);
    } catch {
      // ignore
    }
  }
}

export type SystemdStatus =
  | { installed: true; loaded: boolean; message: string }
  | { installed: false; message: string };

export async function systemdStatus(): Promise<SystemdStatus> {
  assertLinux();
  if (!(await systemdUserSessionAvailable())) {
    return {
      installed: false,
      message:
        "A systemd user session is unavailable in this Linux environment. " +
        "TogetherLink will use portable process mode.",
    };
  }

  const svcPath = servicePath();
  const installed = await readFile(svcPath, "utf8")
    .then(() => true)
    .catch(() => false);

  if (!installed) {
    return {
      installed: false,
      message: `No systemd user service at ${svcPath}. The daemon will not start automatically at login.`,
    };
  }

  let loaded = false;
  try {
    const { stdout } = await promisifiedExecFile("systemctl", [
      "--user",
      "is-active",
      SYSTEMD_SERVICE_NAME,
    ]);
    loaded = stdout.trim() === "active";
  } catch {
    loaded = false;
  }

  return {
    installed: true,
    loaded,
    message: `systemd user service installed at ${svcPath}. Status: ${loaded ? "active" : "installed but not active"}.`,
  };
}

export function systemdServicePath(): string {
  return servicePath();
}

/** Start an installed systemd user service without creating a detached daemon. */
export async function startSystemdService(): Promise<boolean> {
  assertLinux();
  const installed = await readFile(servicePath(), "utf8")
    .then(() => true)
    .catch(() => false);
  if (!installed) {
    return false;
  }
  await promisifiedExecFile("systemctl", ["--user", "start", SYSTEMD_SERVICE_NAME]);
  return true;
}

/** Stop the installed unit; systemd suppresses Restart=always for explicit stops. */
export async function stopSystemdService(): Promise<boolean> {
  assertLinux();
  const installed = await readFile(servicePath(), "utf8")
    .then(() => true)
    .catch(() => false);
  if (!installed) {
    return false;
  }
  await promisifiedExecFile("systemctl", ["--user", "stop", SYSTEMD_SERVICE_NAME]);
  return true;
}
