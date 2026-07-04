import os from "node:os";
import path from "node:path";

/**
 * Resolve the togetherlink home directory — the one source of truth for where
 * the pid file, the sqlite session database, and the codex-app registration
 * file live. Replaces the four byte-identical `resolveTogetherlinkHome()`
 * copies that previously lived in `daemon/{storage,server,launch,
 * app-registration}.ts` plus `daemon/state.ts`, plus the cross-process-boundary
 * `isAlive`/`isProcessAlive` duplicates in `state.ts`/`launch.ts`/`codex-app.ts`.
 *
 * The convention seam between the daemon process and the launcher used to leak
 * as duplicated logic: if one copy changed the resolution, the others would
 * break silently. One home, one liveness check.
 */
export function togetherlinkHome(): string {
  return process.env.TOGETHERLINK_HOME || path.join(os.homedir(), ".togetherlink");
}

/**
 * Whether a pid still has a live process. `process.kill(pid, 0)` sends no
 * signal — it just checks the process exists. ESRCH = dead; EPERM = exists but
 * not ours (treat as alive so we don't reap a session we can't verify).
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}
