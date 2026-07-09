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
 * than throwing, so the orchestrator can degrade to an "open the app manually"
 * message instead of aborting an otherwise-complete configuration.
 *
 * In 2026 OpenAI merged the standalone Codex desktop app into the ChatGPT
 * desktop app, so detection / launch / quit target the "ChatGPT" bundle while
 * still recognising the legacy "Codex" bundle for users who haven't upgraded.
 */

// macOS application bundle names, checked in priority order. The Codex desktop
// app was rebranded into the ChatGPT desktop app, so we look for "ChatGPT"
// first and fall back to the legacy "Codex" bundle.
const MACOS_APP_NAMES = ["ChatGPT", "Codex"];
// Windows process image names, in priority order.
const WIN32_PROCESS_NAMES = ["ChatGPT.exe", "Codex.exe"];

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
    return "ChatGPT App was already open; restart approved and relaunch requested.";
  }
  if (result.wasRunning && result.restartDeclined) {
    return "ChatGPT App is already open. Restart it when you are ready so it reloads this profile.";
  }
  if (result.wasRunning && result.restartUnsupported) {
    return "ChatGPT App is already open, but togetherlink could not restart it. Quit and reopen ChatGPT App when you are ready.";
  }
  if (!result.wasRunning && !result.launchAttempted) {
    return "ChatGPT App was not running.";
  }
  return result.launched
    ? "ChatGPT App launch requested."
    : "Config written, but ChatGPT App could not be launched automatically. Open ChatGPT App manually.";
}

async function shouldRestartCodexApp(reason: CodexAppLaunchReason): Promise<boolean> {
  if (!isInteractive()) {
    return false;
  }
  const clack = await import("@clack/prompts");
  const action =
    reason === "restored"
      ? "reload your restored ChatGPT profile"
      : "reload the Togetherlink profile";
  const restart = await clack.confirm({
    message: `ChatGPT App is already open. Restart it now to ${action}?`,
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
    for (const name of MACOS_APP_NAMES) {
      if (await spawnDetached("open", ["-a", name, process.cwd()])) {
        return true;
      }
    }
    return false;
  }
  if (process.platform === "win32") {
    for (const name of WIN32_PROCESS_NAMES) {
      if (await spawnDetached("cmd", ["/c", "start", "", name])) {
        return true;
      }
    }
    return false;
  }
  return false;
}

export async function isCodexAppRunning(): Promise<boolean> {
  if (process.platform === "darwin") {
    return Boolean(await runningMacosAppName());
  }
  if (process.platform === "win32") {
    return Boolean(await runningWin32ProcessName());
  }
  return false;
}

export async function quitCodexApp(): Promise<boolean> {
  if (process.platform === "darwin") {
    const name = await runningMacosAppName();
    if (!name) {
      return false;
    }
    try {
      await execFileAsync("/usr/bin/osascript", ["-e", `tell application "${name}" to quit`]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  if (process.platform === "win32") {
    const name = await runningWin32ProcessName();
    if (!name) {
      return false;
    }
    try {
      await execFileAsync("taskkill", ["/IM", name]);
      return waitForCodexAppExit();
    } catch {
      return false;
    }
  }
  return false;
}

async function runningMacosAppName(): Promise<string | undefined> {
  for (const name of MACOS_APP_NAMES) {
    try {
      const { stdout } = await execFileAsync("/usr/bin/osascript", [
        "-e",
        `application "${name}" is running`,
      ]);
      if (stdout.trim() === "true") {
        return name;
      }
    } catch {
      // Try the next bundle name.
    }
  }
  return undefined;
}

async function runningWin32ProcessName(): Promise<string | undefined> {
  for (const name of WIN32_PROCESS_NAMES) {
    try {
      const { stdout } = await execFileAsync("tasklist", ["/FI", `IMAGENAME eq ${name}`]);
      if (stdout.toLowerCase().includes(name.toLowerCase())) {
        return name;
      }
    } catch {
      // Try the next process name.
    }
  }
  return undefined;
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
