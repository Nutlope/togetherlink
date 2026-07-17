import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The codex-app session lock module — owns the lock file written on configure
 * (`writeAppSessionLock`) and removed on restore, plus the "is this config one
 * we manage?" check. Carved out of the former 722-line `codex-app.ts` so lock
 * write and config detection are unit-testable without booting a process or
 * touching TOML/backup logic.
 *
 * The lock is currently write-only: the concurrency guard
 * (`assertNoLiveCodexAppSession`) and interrupted-session recovery
 * (`recoverInterruptedCodexApp`) that read it were dead code and have been
 * removed. See PLAN.md "Improvement Backlog" for the re-add-vs-rip-out
 * decision.
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

export async function writeAppSessionLock(home: string, lock: CodexAppSessionLock): Promise<void> {
  await writeTextAtomic(appSessionLockPath(home), `${JSON.stringify(lock, null, 2)}\n`);
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
