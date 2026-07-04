import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Codex App process lifecycle — the deep module behind "open / quit / restart
 * the Codex desktop app". Carved out of the former 722-line `codex-app.ts` so
 * the deletion test passes inside the file: platform-specific osascript /
 * tasklist / taskkill / detached-spawn logic now lives behind one interface,
 * away from TOML manipulation, file backup, and session locking.
 *
 * All functions are best-effort: a failed platform call returns `false` rather
 * than throwing, so the orchestrator can degrade to a "open Codex manually"
 * message instead of aborting an otherwise-complete configuration.
 */

export type CodexAppLaunchResult = {
  launched: boolean;
  launchAttempted: boolean;
  wasRunning: boolean;
  restarted: boolean;
  restartDeclined: boolean;
  restartUnsupported: boolean;
};

export type CodexAppLaunchReason = "configured" | "restored";

export async function launchCodexApp(options: {
  reason: CodexAppLaunchReason;
  openIfClosed: boolean;
}): Promise<CodexAppLaunchResult> {
  const wasRunning = await isCodexAppRunning();
  let restarted = false;
  let restartDeclined = false;
  let restartUnsupported = false;

  if (wasRunning) {
    if (await shouldRestartCodexApp(options.reason)) {
      restarted = await quitCodexApp();
      restartUnsupported = !restarted;
    } else {
      restartDeclined = true;
    }
  }

  const launchAttempted = !(restartDeclined || restartUnsupported || !options.openIfClosed);
  const launched = launchAttempted ? await openCodexApp() : false;
  return { launched, launchAttempted, wasRunning, restarted, restartDeclined, restartUnsupported };
}

export function codexAppLaunchMessage(result: CodexAppLaunchResult): string {
  if (result.wasRunning && result.restarted && result.launched) {
    return "Codex App was already open; restart approved and relaunch requested.";
  }
  if (result.wasRunning && result.restartDeclined) {
    return "Codex App is already open. Restart it when you are ready so it reloads this profile.";
  }
  if (result.wasRunning && result.restartUnsupported) {
    return "Codex App is already open, but togetherlink could not restart it. Quit and reopen Codex App when you are ready.";
  }
  if (!result.wasRunning && !result.launchAttempted) {
    return "Codex App was not running.";
  }
  return result.launched
    ? "Codex App launch requested."
    : "Config written, but Codex App could not be launched automatically. Open Codex App manually.";
}

async function shouldRestartCodexApp(reason: CodexAppLaunchReason): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const clack = await import("@clack/prompts");
  const action =
    reason === "restored"
      ? "reload your restored Codex profile"
      : "reload the Togetherlink profile";
  const restart = await clack.confirm({
    message: `Codex App is already open. Restart it now to ${action}?`,
    initialValue: false,
  });
  return restart === true;
}

export async function openCodexApp(): Promise<boolean> {
  const launchedViaCodex = await spawnDetached("codex", ["app", process.cwd()]);
  if (launchedViaCodex) {
    return true;
  }
  if (process.platform === "darwin") {
    return spawnDetached("open", ["-a", "Codex", process.cwd()]);
  }
  if (process.platform === "win32") {
    return spawnDetached("cmd", ["/c", "start", "", "Codex"]);
  }
  return false;
}

export async function isCodexAppRunning(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("/usr/bin/osascript", [
        "-e",
        'application "Codex" is running',
      ]);
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("tasklist", ["/FI", "IMAGENAME eq Codex.exe"]);
      return /\bCodex\.exe\b/i.test(stdout);
    } catch {
      return false;
    }
  }
  return false;
}

export async function quitCodexApp(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      await execFileAsync("/usr/bin/osascript", ["-e", 'tell application "Codex" to quit']);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill", ["/IM", "Codex.exe"]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  return false;
}

async function waitForCodexAppExit(): Promise<boolean> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!(await isCodexAppRunning())) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

async function spawnDetached(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
