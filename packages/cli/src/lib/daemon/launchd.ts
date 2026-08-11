import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import { togetherlinkHome } from "../paths.js";

const AUTO_INSTALL_SENTINEL = "launchd-auto-installed";

function autoInstallSentinelPath(): string {
  return path.join(togetherlinkHome(), AUTO_INSTALL_SENTINEL);
}

export async function maybeAutoInstallLaunchdDaemon(): Promise<boolean> {
  if (!isMacOS()) return false;
  // Do not try to (re-)install the agent from inside the launchd-managed daemon
  // process itself; the agent is already responsible for starting it.
  if (process.argv.includes("--daemon")) return false;
  if (process.argv[2] === "daemon") return false;
  const sentinel = autoInstallSentinelPath();
  const already = await readFile(sentinel, "utf8")
    .then(() => true)
    .catch(() => false);
  if (already) return false;
  // Only auto-install for the installed bundle, not a dev checkout.
  if (!(await runningFromBundle())) return false;
  try {
    const result = await installLaunchdDaemon();
    if (result.installed) {
      await writeFile(sentinel, new Date().toISOString(), { mode: 0o600 });
    }
    return result.installed;
  } catch (err) {
    // Failing silently is acceptable for an automatic migration.
    return false;
  }
}

const LAUNCHD_LABEL = "com.togetherlink.daemon";

function launchAgentsDir(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents");
}

function plistPath(): string {
  return path.join(launchAgentsDir(), `${LAUNCHD_LABEL}.plist`);
}

function bundleExecutable(): string {
  return path.join(togetherlinkHome(), "bin", "togetherlink");
}

/**
 * Return a PATH string that should let the launchd job find `bun` even when
 * the user's shell startup files have not been sourced. Common install
 * locations plus the current process PATH are included.
 */
export function launchdPath(): string {
  const home = os.homedir();
  const parts = [
    path.join(home, ".bun", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  if (process.env.PATH) {
    for (const part of process.env.PATH.split(":").map((p) => p.trim())) {
      if (part && !parts.includes(part)) {
        parts.push(part);
      }
    }
  }
  return parts.join(":");
}

type LaunchdPlist = {
  Label: string;
  ProgramArguments: string[];
  RunAtLoad: boolean;
  KeepAlive: boolean;
  StandardOutPath: string;
  StandardErrorPath: string;
  EnvironmentVariables: {
    TOGETHERLINK_HOME: string;
    PATH: string;
  };
};

export function generateLaunchdPlist(overrides?: { program?: string; home?: string }): string {
  const home = overrides?.home ?? togetherlinkHome();
  const program = overrides?.program ?? bundleExecutable();
  const logDir = path.join(home, "logs");
  const plist: LaunchdPlist = {
    Label: LAUNCHD_LABEL,
    ProgramArguments: [program, "daemon", "serve"],
    RunAtLoad: true,
    KeepAlive: true,
    StandardOutPath: path.join(logDir, "daemon.log"),
    StandardErrorPath: path.join(logDir, "daemon.log"),
    EnvironmentVariables: {
      TOGETHERLINK_HOME: home,
      PATH: launchdPath(),
    },
  };
  return buildPlist(plist);
}

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
    `  <key>StandardOutPath</key>`,
    `  <string>${escapeXml(plist.StandardOutPath)}</string>`,
    `  <key>StandardErrorPath</key>`,
    `  <string>${escapeXml(plist.StandardErrorPath)}</string>`,
    `  <key>EnvironmentVariables</key>`,
    "  <dict>",
    `    <key>TOGETHERLINK_HOME</key>`,
    `    <string>${escapeXml(plist.EnvironmentVariables.TOGETHERLINK_HOME)}</string>`,
    `    <key>PATH</key>`,
    `    <string>${escapeXml(plist.EnvironmentVariables.PATH)}</string>`,
    "  </dict>",
    "</dict>",
    "</plist>",
    "",
  );
  return lines.join("\n");
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

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

function assertMacOS(): void {
  if (!isMacOS()) {
    throw new Error("LaunchAgents are only supported on macOS.");
  }
}

async function runningFromBundle(): Promise<boolean> {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    const resolved = await realpath(argv1);
    const home = togetherlinkHome();
    return (
      resolved === path.join(home, "bin", "togetherlink.js") ||
      resolved === path.join(home, "bin", "togetherlink")
    );
  } catch {
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

  // Best-effort unload first to avoid "service already loaded" errors.
  await Promise.resolve().then(async () => {
    try {
      await promisifiedExecFile("launchctl", ["unload", plistDest]);
    } catch {
      // ignored
    }
  });

  await promisifiedExecFile("launchctl", ["load", plistDest]);

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

  const exists = await readFile(plistDest, "utf8")
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    return {
      removed: false,
      message: `No launchd agent found at ${plistDest}.`,
    };
  }

  try {
    await promisifiedExecFile("launchctl", ["unload", plistDest]);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      // ignore load-domain errors; the job may not be running
    }
  }

  await unlink(plistDest);

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
    const { stdout } = await promisifiedExecFile("launchctl", ["list", LAUNCHD_LABEL]);
    loaded = stdout.includes("PID") || !stdout.includes("Could not find");
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
