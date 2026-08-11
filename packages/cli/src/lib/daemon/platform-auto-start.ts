import {
  isMacOS,
  installLaunchdDaemon,
  launchdStatus,
  startLaunchdDaemon,
  uninstallLaunchdDaemon,
} from "./launchd.js";
import {
  isLinux,
  maybeAutoInstallSystemdService,
  installSystemdService,
  startSystemdService,
  systemdStatus,
  uninstallSystemdService,
} from "./systemd.js";

export async function maybeAutoInstallService(): Promise<boolean> {
  if (isMacOS()) {
    const { maybeAutoInstallLaunchdDaemon } = await import("./launchd.js");
    return maybeAutoInstallLaunchdDaemon();
  }
  if (isLinux()) {
    return maybeAutoInstallSystemdService();
  }
  return false;
}

export async function installAutoStart(): Promise<{ installed: boolean; message: string }> {
  if (isMacOS()) {
    return installLaunchdDaemon();
  }
  if (isLinux()) {
    return installSystemdService();
  }
  throw new Error("Auto-start is only supported on macOS and Linux.");
}

export async function uninstallAutoStart(): Promise<{ removed: boolean; message: string }> {
  if (isMacOS()) {
    return uninstallLaunchdDaemon();
  }
  if (isLinux()) {
    return uninstallSystemdService();
  }
  throw new Error("Auto-start is only supported on macOS and Linux.");
}

export async function startAutoStart(): Promise<boolean> {
  if (isMacOS()) {
    return startLaunchdDaemon();
  }
  if (isLinux()) {
    return startSystemdService();
  }
  return false;
}

export type AutoStartStatus =
  | { installed: true; loaded: boolean; message: string }
  | { installed: false; message: string };

export async function autoStartStatus(): Promise<AutoStartStatus> {
  if (isMacOS()) {
    return launchdStatus();
  }
  if (isLinux()) {
    return systemdStatus();
  }
  return {
    installed: false,
    message: "Auto-start is only supported on macOS and Linux.",
  };
}

export function autoStartSupportedPlatform(): "macos" | "linux" | "unsupported" {
  if (isMacOS()) return "macos";
  if (isLinux()) return "linux";
  return "unsupported";
}
