import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLAUDE_LOCAL_PROXY_HOST } from "../claude/defaults.js";
import { probeHealthz, resolveDaemonPort, daemonUrl, daemonPidPath } from "./server.js";
import type { RegisterSessionRequest } from "./state.js";

const HEALTH_POLL_INTERVAL_MS = 200;
const HEALTH_POLL_TIMEOUT_MS = 5000;

/** Timeout for the launcher's internal daemon calls (register/cost/deregister). */
const DAEMON_CALL_TIMEOUT_MS = 3000;
const SESSION_KEEPALIVE_INTERVAL_MS = 500;
const LOCAL_PROXY_TOKEN_FILE = "local-proxy-token";

/**
 * Ensure the shared proxy daemon is running on the fixed port and return its
 * URL. Idempotent: if a healthy daemon already answers `healthz`, reuse it; if
 * not, spawn a detached copy of this process in `--daemon` mode and poll until
 * it's ready. Never throws on a missing/stale pid file — it just spawns fresh.
 *
 * The launcher calls this before spawning `claude`, then registers its session
 * token with the daemon. The daemon outlives the launcher, so N sessions share
 * one daemon process (the whole point of Phase 1).
 */
export async function ensureDaemon(): Promise<{ url: string }> {
  const port = resolveDaemonPort();
  const url = daemonUrl(port);

  if (await probeHealthz(port)) {
    return { url };
  }

  // The probe failed. If a pid file points at a dead process, clean it up so
  // the freshly-spawned daemon owns the file (the old daemon would have
  // removed it on shutdown, but a kill -9 leaves it stale).
  await clearStalePidFile();

  // Spawn a detached daemon copy of the CLI entrypoint. `process.execPath` is
  // `bun` under the installed bundle (or `node` in dev). The script path MUST
  // be the bin entry — the file that dispatches `--daemon` to `runDaemon()` —
  // not this module's own URL: in the multi-file `tsc` dist build,
  // `import.meta.url` points at `dist/lib/daemon/launch.js`, which only exports
  // symbols and has no top-level main, so a self-spawn of it would exit
  // immediately and ensureDaemon would always time out. `process.argv[1]` is
  // the entry the user invoked (the bundle path, or `dist/bin/togetherlink.js`
  // in dev) in both builds.
  const scriptPath = currentScriptPath();
  const child = spawn(process.execPath, [scriptPath, "--daemon"], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      TOGETHERLINK_PORT: String(port),
    },
  });
  child.unref();

  // Wait for the new daemon to become healthy.
  const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(HEALTH_POLL_INTERVAL_MS);
    if (await probeHealthz(port)) {
      return { url };
    }
  }
  throw new Error(
    `togetherlink daemon did not become healthy on ${url} within ${HEALTH_POLL_TIMEOUT_MS / 1000}s. ` +
      `Set TOGETHERLINK_PORT to use a different port.`,
  );
}

/**
 * Absolute path of the CLI entrypoint, for `bun/node <scriptPath> --daemon`.
 * Prefers `process.argv[1]` (the entry the user actually invoked — the bundle
 * under the install, or `dist/bin/togetherlink.js` under `pnpm dev`), resolved
 * to an absolute path. Falls back to this module's `import.meta.url` only if
 * argv[1] is unavailable; note that import.meta.url is the wrong target in the
 * multi-file tsc dist (see the call-site comment above).
 */
function currentScriptPath(): string {
  const argv1 = process.argv[1];
  if (argv1) {
    return path.isAbsolute(argv1) ? argv1 : path.resolve(argv1);
  }
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return import.meta.url;
  }
}

/** Remove the pid file if it names a process that is no longer alive. */
async function clearStalePidFile(): Promise<void> {
  let pid: number | undefined;
  try {
    const raw = (await readFile(daemonPidPath(), "utf8")).trim();
    pid = raw ? Number.parseInt(raw, 10) : undefined;
  } catch {
    return; // no pid file; nothing to clear
  }
  if (!pid || !Number.isFinite(pid)) {
    try {
      await unlink(daemonPidPath());
    } catch {
      // ignore
    }
    return;
  }
  if (isProcessAlive(pid)) {
    return; // a real daemon is still up but healthz missed — leave the file
  }
  try {
    await unlink(daemonPidPath());
  } catch {
    // ignore
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Internal fetch to the daemon with an abort timeout, so a daemon that accepts
 * the socket but never responds can't hang the launcher (the health probe has
 * its own timeout; these calls didn't). Resolves to the Response on success or
 * throws on timeout/network error. The launcher wraps callers in try/catch so a
 * failure is best-effort, but a *hang* would block indefinitely without this.
 */
export async function daemonFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DAEMON_CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function registerDaemonSession(proxyUrl: string, registration: RegisterSessionRequest): Promise<void> {
  const response = await daemonFetch(`${proxyUrl}/internal/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(registration),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`daemon registration failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}

export async function updateDaemonSessionPid(proxyUrl: string, token: string, pid: number): Promise<void> {
  await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(token)}/pid`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pid }),
  });
}

export async function localProxyAuthToken(): Promise<string> {
  const file = path.join(resolveTogetherlinkHome(), LOCAL_PROXY_TOKEN_FILE);
  try {
    const token = (await readFile(file, "utf8")).trim();
    if (token) {
      return token;
    }
  } catch {
    // Create below.
  }
  const token = `togetherlink-local-${randomBytes(32).toString("base64url")}`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  return token;
}

export function daemonSessionUrl(proxyUrl: string, sessionId: string): string {
  return `${proxyUrl}/session/${encodeURIComponent(sessionId)}`;
}

export function startDaemonSessionKeepalive(
  registration: RegisterSessionRequest,
  options: { pid?: number; debug?: boolean; label?: string } = {},
): { stop: () => void } {
  let stopped = false;
  let inFlight = false;
  let lastRecoveredAt = 0;

  const recover = async (reason: string) => {
    const now = Date.now();
    if (now - lastRecoveredAt < SESSION_KEEPALIVE_INTERVAL_MS) {
      return;
    }
    lastRecoveredAt = now;
    const { url } = await ensureDaemon();
    await registerDaemonSession(url, { ...registration, ...(options.pid !== undefined ? { pid: options.pid } : {}) });
    if (options.debug) {
      process.stderr.write(`[togetherlink daemon] restored ${options.label ?? registration.agent ?? "session"} after ${reason}.\n`);
    }
  };

  const safeRecover = async (reason: string) => {
    try {
      await recover(reason);
    } catch (err) {
      if (options.debug) {
        process.stderr.write(
          `[togetherlink daemon] could not restore ${options.label ?? registration.agent ?? "session"}: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
      }
    }
  };

  const tick = () => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    void (async () => {
      const port = resolveDaemonPort();
      const url = daemonUrl(port);
      try {
        const response = await daemonFetch(`${url}/internal/sessions/${encodeURIComponent(registration.token)}/cost`);
        if (response.status === 404 || response.status === 401) {
          await safeRecover(`missing session (${response.status})`);
        }
      } catch (err) {
        await safeRecover(err instanceof Error ? err.message : "daemon unreachable");
      } finally {
        inFlight = false;
      }
    })();
  };

  const timer = setInterval(tick, SESSION_KEEPALIVE_INTERVAL_MS);
  timer.unref();
  tick();
  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export { CLAUDE_LOCAL_PROXY_HOST };

function resolveTogetherlinkHome(): string {
  return process.env.TOGETHERLINK_HOME || path.join(os.homedir(), ".togetherlink");
}
