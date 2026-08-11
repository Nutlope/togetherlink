import { readFile } from "node:fs/promises";
import path from "node:path";
import { togetherlinkHome } from "../paths.js";
import { daemonPidPath, probeDaemonHealth, resolveDaemonPort } from "./server.js";

const TAKEOVER_TIMEOUT_MS = 5_000;
const TAKEOVER_POLL_INTERVAL_MS = 50;

export type DaemonTakeoverResult = { stopped: false } | { stopped: true; pid: number };

/**
 * Stop a healthy TogetherLink daemon before launchd/systemd takes ownership of
 * the fixed proxy port. This is the upgrade seam from the legacy detached
 * daemon: the persisted session store and codex-app registration survive the
 * short process restart, but only the OS-managed daemon remains afterward.
 */
export async function stopLegacyDaemonForTakeover(): Promise<DaemonTakeoverResult> {
  const port = resolveDaemonPort();
  const health = await probeDaemonHealth(port);
  if (health === undefined) {
    return { stopped: false };
  }

  const expectedHome = path.resolve(togetherlinkHome());
  if (health.home !== null && path.resolve(health.home) !== expectedHome) {
    throw new Error(`Refusing to stop daemon from a different TogetherLink home (${health.home}).`);
  }

  const pid = health.pid > 0 ? health.pid : await readDaemonPid();
  if (pid === undefined || pid === process.pid) {
    throw new Error("Could not safely identify the legacy TogetherLink daemon process.");
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") {
      return { stopped: false };
    }
    throw err;
  }

  const deadline = Date.now() + TAKEOVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await probeDaemonHealth(port)) === undefined) {
      return { stopped: true, pid };
    }
    await sleep(TAKEOVER_POLL_INTERVAL_MS);
  }

  throw new Error(`Legacy TogetherLink daemon ${pid} did not release port ${port}.`);
}

/** Wait until the replacement daemon owns the configured port. */
export async function waitForManagedDaemonReady(): Promise<void> {
  const port = resolveDaemonPort();
  const deadline = Date.now() + TAKEOVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await probeDaemonHealth(port)) !== undefined) {
      return;
    }
    await sleep(TAKEOVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Managed TogetherLink daemon did not become healthy on port ${port}.`);
}

async function readDaemonPid(): Promise<number | undefined> {
  try {
    const raw = (await readFile(daemonPidPath(), "utf8")).trim();
    const pid = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
