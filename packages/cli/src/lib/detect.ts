import { spawnSync } from "node:child_process";
import { ALL_HARNESSES, HARNESS_BIN, HARNESS_INSTALL, HARNESS_LABEL, type HarnessId } from "./harness.js";

export type HarnessDetection = {
  installed: boolean;
  path: string | null;
};

/**
 * Resolve a binary's absolute path via the OS's own lookup (`which` on
 * POSIX, `where` on Windows) rather than re-implementing PATH search —
 * matches exactly what the shell would find.
 */
function resolveBinPath(bin: string): string | null {
  const isWindows = process.platform === "win32";
  const result = spawnSync(isWindows ? "where" : "which", [bin], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  const path = result.stdout.trim().split("\n")[0]?.trim();
  return path || null;
}

export function detectInstalledHarnesses(harnesses: readonly HarnessId[] = ALL_HARNESSES): Record<HarnessId, HarnessDetection> {
  const result = {} as Record<HarnessId, HarnessDetection>;
  for (const harness of harnesses) {
    const path = resolveBinPath(HARNESS_BIN[harness]);
    result[harness] = { installed: Boolean(path), path };
  }
  return result;
}

export function detectInstalledHarness(harness: HarnessId): HarnessDetection {
  const path = resolveBinPath(HARNESS_BIN[harness]);
  return { installed: Boolean(path), path };
}

export function missingHarnessMessage(harness: HarnessId): string {
  const install = HARNESS_INSTALL[harness];
  return [
    `${HARNESS_LABEL[harness]} is not installed or "${HARNESS_BIN[harness]}" is not on PATH.`,
    `Install it with: ${install.command}`,
    `Docs: ${install.url}`,
    `Then re-run: togetherlink ${harness}`,
  ].join("\n");
}
