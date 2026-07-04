import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isProcessAlive } from "../paths.js";

/**
 * The codex-app session lock — the deep module behind "is another codex-app
 * session already running?". Carved out of the former 722-line `codex-app.ts`
 * so the deletion test passes inside the file: lock read/write/recover + the
 * "is this config one we manage?" check now live behind their own interface,
 * unit-testable without booting a process or touching TOML/backup logic.
 *
 * `recoverInterruptedCodexApp` stays in the orchestrator (`codex-app.ts`)
 * because it composes lock-read + restore + launch — it's not lock logic.
 */

export type CodexAppSessionLock = {
  pid: number;
  startedAt: string;
  sessionToken: string;
  configPath: string;
  catalogPath: string;
};

export function appSessionLockPath(home: string): string {
  return path.join(togetherlinkHomeDir(home), "codex-app", "session.json");
}

function togetherlinkHomeDir(home: string): string {
  return process.env.TOGETHERLINK_HOME || path.join(home, ".togetherlink");
}

export async function readAppSessionLock(home: string): Promise<CodexAppSessionLock | undefined> {
  const raw = await readTextIfExists(appSessionLockPath(home));
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as CodexAppSessionLock;
    if (typeof parsed.pid === "number" && typeof parsed.sessionToken === "string") {
      return parsed;
    }
  } catch {
    // Invalid lock files are treated as stale and overwritten by the next session.
  }
  return undefined;
}

export async function writeAppSessionLock(home: string, lock: CodexAppSessionLock): Promise<void> {
  await writeTextAtomic(appSessionLockPath(home), `${JSON.stringify(lock, null, 2)}\n`);
}

export async function assertNoLiveCodexAppSession(home: string): Promise<void> {
  const lock = await readAppSessionLock(home);
  if (!lock || lock.pid === process.pid || !isProcessAlive(lock.pid)) {
    return;
  }
  throw new Error(
    `Another togetherlink codex-app session appears to be running (pid ${lock.pid}). Stop it with Ctrl+C, or run \`togetherlink codex-app --restore\` after it exits.`,
  );
}

/**
 * Is the codex config at ~/.codex/config.toml one that togetherlink wrote?
 * Detects both the current managed block (marker comments) and the legacy
 * openai-provider+local-proxy+catalog triplet. Used by the orchestrator to
 * decide whether an interrupted session is recoverable, and by backup to
 * decide whether to reuse an existing backup.
 */
export async function isManagedCodexAppConfig(
  home: string,
  configPath: string,
  markerStart: string,
  modelCatalogPath: string,
): Promise<boolean> {
  const raw = await readTextIfExists(configPath);
  if (!raw) {
    return false;
  }
  if (raw.includes(markerStart)) {
    return true;
  }
  return (
    raw.includes('model_provider = "openai"') &&
    raw.includes('openai_base_url = "http://127.0.0.1:') &&
    raw.includes(modelCatalogPath)
  );
}

// --- small I/O helpers co-located with the lock (atomic write, exists check) ---

async function readTextIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
}

async function writeTextAtomic(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, value, { encoding: "utf8", mode: 0o600 });
  await rename(tmp, file);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

// avoid a dead-import lint once togetherlinkHomeDir is consolidated (see #7).
