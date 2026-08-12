import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { togetherlinkHome } from "../paths.js";
import { runningFromBundle } from "./detect-bundle.js";
import { stopLegacyDaemonForTakeover, waitForManagedDaemonReady } from "./takeover.js";

const AUTO_INSTALL_SENTINEL = "launchd-supervision-v4-installed";
const PREVIOUS_AUTO_INSTALL_SENTINELS = [
  "launchd-supervision-v3-installed",
  "launchd-supervision-v2-installed",
];
const LEGACY_AUTO_INSTALL_SENTINEL = "launchd-auto-installed";
const LAUNCHD_LABEL = "com.togetherlink.daemon";

function autoInstallSentinelPath(): string {
  return path.join(togetherlinkHome(), AUTO_INSTALL_SENTINEL);
}

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

function assertMacOS(): void {
  if (!isMacOS()) {
    throw new Error("LaunchAgents are only supported on macOS.");
  }
}

function launchAgentsDir(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents");
}

function plistPath(): string {
  return path.join(launchAgentsDir(), `${LAUNCHD_LABEL}.plist`);
}

function bundleExecutable(): string {
  return path.join(togetherlinkHome(), "bin", "togetherlink");
}

function bundleScript(home = togetherlinkHome()): string {
  return path.join(home, "bin", "togetherlink.js");
}

function launchctlDomain(): string {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

function isInsideLaunchdJob(): boolean {
  return process.env.LAUNCHD_SESSION_TYPE !== undefined || process.env.PPID === "1";
}

/**
 * Return a conservative PATH that lets the launchd job find `bun` without
 * leaking the current caller's PATH, which may contain temp agent/runtime
 * directories. The common macOS package-manager dirs and bun's default
 * install location are included.
 */
export function launchdPath(): string {
  const home = os.homedir();
  return [
    path.join(home, ".bun", "bin"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":");
}

type LaunchdPlist = {
  Label: string;
  ProgramArguments: string[];
  RunAtLoad: boolean;
  KeepAlive: boolean;
  ThrottleInterval: number;
  StandardOutPath: string;
  StandardErrorPath: string;
  EnvironmentVariables: {
    TOGETHERLINK_HOME: string;
    TOGETHERLINK_SUPERVISED: string;
    PATH: string;
  };
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPlist(plist: LaunchdPlist): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    `  <key>Label</key>`,
    `  <string>${escapeXml(plist.Label)}</string>`,
    `  <key>ProgramArguments</key>`,
    "  <array>",
  ];
  for (const arg of plist.ProgramArguments) {
    lines.push(`    <string>${escapeXml(arg)}</string>`);
  }
  lines.push(
    "  </array>",
    `  <key>RunAtLoad</key>`,
    plist.RunAtLoad ? "  <true/>" : "  <false/>",
    `  <key>KeepAlive</key>`,
    plist.KeepAlive ? "  <true/>" : "  <false/>",
    `  <key>ThrottleInterval</key>`,
    `  <integer>${plist.ThrottleInterval}</integer>`,
    `  <key>StandardOutPath</key>`,
    `  <string>${escapeXml(plist.StandardOutPath)}</string>`,
    `  <key>StandardErrorPath</key>`,
    `  <string>${escapeXml(plist.StandardErrorPath)}</string>`,
    `  <key>EnvironmentVariables</key>`,
    "  <dict>",
    `    <key>TOGETHERLINK_HOME</key>`,
    `    <string>${escapeXml(plist.EnvironmentVariables.TOGETHERLINK_HOME)}</string>`,
    `    <key>TOGETHERLINK_SUPERVISED</key>`,
    `    <string>${escapeXml(plist.EnvironmentVariables.TOGETHERLINK_SUPERVISED)}</string>`,
    `    <key>PATH</key>`,
    `    <string>${escapeXml(plist.EnvironmentVariables.PATH)}</string>`,
    "  </dict>",
    "</dict>",
    "</plist>",
    "",
  );
  return lines.join("\n");
}

export function generateLaunchdPlist(overrides?: {
  runtime?: string;
  bundle?: string;
  home?: string;
}): string {
  const home = overrides?.home ?? togetherlinkHome();
  const runtime = overrides?.runtime ?? process.execPath;
  const bundle = overrides?.bundle ?? bundleScript(home);
  const logDir = path.join(home, "logs");
  const plist: LaunchdPlist = {
    Label: LAUNCHD_LABEL,
    // Pin the runtime that is successfully executing the installed CLI now.
    // launchd does not inherit the user's interactive PATH, so invoking the
    // shell wrapper can fail with `exec: bun: not found` for mise/asdf/etc.
    ProgramArguments: [runtime, bundle, "daemon", "serve"],
    RunAtLoad: true,
    // The proxy is an availability service. Restart even after exit(0): a
    // SIGTERM is handled gracefully by the daemon and therefore looks like a
    // successful exit to launchd. Intentional stops unload the job first.
    KeepAlive: true,
    ThrottleInterval: 10,
    StandardOutPath: path.join(logDir, "daemon.log"),
    StandardErrorPath: path.join(logDir, "daemon.log"),
    EnvironmentVariables: {
      TOGETHERLINK_HOME: home,
      TOGETHERLINK_SUPERVISED: "1",
      PATH: launchdPath(),
    },
  };
  return buildPlist(plist);
}

function promisifiedExecFile(
  file: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: "utf8" }, (err, stdout, stderr) => {
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
 * One-time migration: install the launchd agent for existing macOS users the
 * first time they run the installed bundle. It is silent, non-blocking, and
 * skipped when already installed or when running the daemon itself.
 */
export async function maybeAutoInstallLaunchdDaemon(): Promise<boolean> {
  if (!isMacOS()) return false;
  if (isInsideLaunchdJob()) return false;
  if (process.argv.includes("--daemon") || process.argv[2] === "daemon") return false;

  const sentinel = autoInstallSentinelPath();
  const already = await readFile(sentinel, "utf8")
    .then(() => true)
    .catch(() => false);
  if (already) return false;

  if (!(await runningFromBundle())) return false;

  try {
    const result = await installLaunchdDaemon();
    return result.installed;
  } catch (err) {
    // Failing silently is acceptable for an automatic migration.
    return false;
  }
}

/**
 * Install a launchd user agent that starts the TogetherLink daemon at login
 * and keeps it alive.
 */
export async function installLaunchdDaemon(): Promise<{ installed: boolean; message: string }> {
  assertMacOS();
  const plistDest = plistPath();
  const agentsDir = launchAgentsDir();
  const domain = launchctlDomain();
  await mkdir(agentsDir, { recursive: true });
  await mkdir(path.join(togetherlinkHome(), "logs"), { recursive: true });

  if (!(await runningFromBundle())) {
    const argv1 = process.argv[1] ?? "unknown";
    return {
      installed: false,
      message:
        `Auto-start is only configured for the installed bundle (${bundleExecutable()}). ` +
        `This process was started from ${argv1}. Run install.sh first, then use the installed togetherlink command.`,
    };
  }

  const plistContent = generateLaunchdPlist();
  await writeFile(plistDest, plistContent, { mode: 0o644 });

  // Best-effort bootout of any previous registration before bootstrapping.
  try {
    await promisifiedExecFile("launchctl", ["bootout", domain, plistDest]);
  } catch {
    // ignore — may not have been loaded
  }

  // The legacy CLI spawned a detached daemon before launchd existed. It may
  // still own port 7878 even after bootout, causing the new launchd job to
  // exit cleanly and leave no supervisor. Explicitly transfer ownership.
  await stopLegacyDaemonForTakeover();

  await promisifiedExecFile("launchctl", ["bootstrap", domain, plistDest]);
  await promisifiedExecFile("launchctl", ["enable", `${domain}/${LAUNCHD_LABEL}`]);
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

  return {
    installed: true,
    message: `Installed launchd agent: ${plistDest}\nThe TogetherLink daemon will now start at login and restart if it exits.`,
  };
}

/**
 * Remove the launchd user agent and stop the auto-started daemon.
 */
export async function uninstallLaunchdDaemon(): Promise<{ removed: boolean; message: string }> {
  assertMacOS();
  const plistDest = plistPath();
  const domain = launchctlDomain();

  const exists = await readFile(plistDest, "utf8")
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    return {
      removed: false,
      message: `No launchd agent found at ${plistDest}.`,
    };
  }

  // Stop the job before removing the plist so we don't leave a loaded orphan.
  let stopped = false;
  try {
    await promisifiedExecFile("launchctl", ["bootout", domain, plistDest]);
    stopped = true;
  } catch (err) {
    const message = (err as Error).message ?? "";
    stopped =
      message.includes("No such file") ||
      message.includes("not loaded") ||
      (err as NodeJS.ErrnoException).code === "ENOENT";
  }

  if (!stopped) {
    return {
      removed: false,
      message:
        `Could not unload launchd agent at ${plistDest}. ` +
        `Run \`launchctl bootout ${domain} '${plistDest}'\` and remove the file manually.`,
    };
  }

  await unlink(plistDest);
  // Clean up the sentinel so a future CLI run can re-offer auto-install if desired.
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

  return {
    removed: true,
    message: `Removed launchd agent: ${plistDest}\nThe TogetherLink daemon will no longer start automatically at login.`,
  };
}

export type LaunchdStatus =
  | { installed: true; loaded: boolean; message: string }
  | { installed: false; message: string };

/**
 * Report whether the launchd agent is installed and currently loaded.
 */
export async function launchdStatus(): Promise<LaunchdStatus> {
  assertMacOS();
  const plistDest = plistPath();
  const domain = launchctlDomain();

  const installed = await readFile(plistDest, "utf8")
    .then(() => true)
    .catch(() => false);

  if (!installed) {
    return {
      installed: false,
      message: `No launchd agent at ${plistDest}. The daemon will not start automatically at login.`,
    };
  }

  let loaded = false;
  try {
    const { stdout } = await promisifiedExecFile("launchctl", [
      "print",
      `${domain}/${LAUNCHD_LABEL}`,
    ]);
    loaded = stdout.includes("PID") || stdout.includes("state = running");
  } catch {
    loaded = false;
  }

  return {
    installed: true,
    loaded,
    message: `Launchd agent installed at ${plistDest}. Status: ${loaded ? "loaded/running" : "installed but not loaded"}.`,
  };
}

export function launchdPlistPath(): string {
  return plistPath();
}

/** Start an installed launchd job without creating a detached daemon. */
export async function startLaunchdDaemon(): Promise<boolean> {
  assertMacOS();
  const plistDest = plistPath();
  const installed = await readFile(plistDest, "utf8")
    .then(() => true)
    .catch(() => false);
  if (!installed) {
    return false;
  }

  const domain = launchctlDomain();
  try {
    await promisifiedExecFile("launchctl", ["kickstart", "-k", `${domain}/${LAUNCHD_LABEL}`]);
  } catch {
    await promisifiedExecFile("launchctl", ["bootstrap", domain, plistDest]);
    await promisifiedExecFile("launchctl", ["enable", `${domain}/${LAUNCHD_LABEL}`]);
  }
  return true;
}

/** Stop and unload the installed job so KeepAlive does not immediately restart it. */
export async function stopLaunchdDaemon(): Promise<boolean> {
  assertMacOS();
  const plistDest = plistPath();
  const installed = await readFile(plistDest, "utf8")
    .then(() => true)
    .catch(() => false);
  if (!installed) {
    return false;
  }

  try {
    await promisifiedExecFile("launchctl", ["bootout", launchctlDomain(), plistDest]);
    return true;
  } catch {
    return false;
  }
}
