import { readFile, unlink } from "node:fs/promises";
import { probeHealthz, resolveDaemonPort, daemonUrl, daemonPidPath } from "./server.js";

/**
 * `togetherlink daemon status` / `togetherlink daemon stop`. These are thin
 * user-facing controls over the shared proxy daemon; the daemon itself is
 * started lazily by `togetherlink claude` via `ensureDaemon`.
 */
export async function runDaemonCommand(verb: string | undefined): Promise<void> {
  const resolved = verb ?? "status";
  if (resolved === "status") {
    await daemonStatus();
    return;
  }
  if (resolved === "stop") {
    await daemonStop();
    return;
  }
  if (resolved === "serve") {
    const { runDaemon } = await import("./server.js");
    await runDaemon();
    return;
  }
  throw new Error(`Unknown "daemon ${verb ?? ""}" command. Expected: status, stop.`);
}

async function daemonStatus(): Promise<void> {
  const port = resolveDaemonPort();
  const healthy = await probeHealthz(port);
  if (!healthy) {
    console.log(`togetherlink daemon: not running on ${daemonUrl(port)}`);
    return;
  }
  let sessionCount = 0;
  try {
    const response = await fetch(`${daemonUrl(port)}/internal/sessions`);
    if (response.ok) {
      const body = (await response.json()) as { sessions?: unknown[] };
      sessionCount = body.sessions?.length ?? 0;
    }
  } catch {
    // sessions endpoint unreachable; just report the daemon is up
  }
  const pid = await readPid();
  console.log(
    `togetherlink daemon: running on ${daemonUrl(port)}` +
      (pid !== undefined ? ` (pid ${pid})` : "") +
      (sessionCount > 0 ? `, ${sessionCount} active session${sessionCount === 1 ? "" : "s"}` : ""),
  );
}

async function daemonStop(): Promise<void> {
  const port = resolveDaemonPort();
  const pid = await readPid();
  if (pid === undefined) {
    console.log(`togetherlink daemon: not running (no pid file at ${daemonPidPath()}).`);
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") {
      try {
        await unlink(daemonPidPath());
      } catch {
        // ignore
      }
      console.log(`togetherlink daemon: not running (stale pid file removed).`);
      return;
    }
    throw err;
  }
  // Best-effort: the daemon removes its own pid file on SIGTERM. Give it a
  // moment, then clear a leftover if the signal was lost.
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    await unlink(daemonPidPath());
  } catch {
    // already cleaned by the daemon
  }
  console.log(`togetherlink daemon: stopped (pid ${pid}) on ${daemonUrl(port)}.`);
}

async function readPid(): Promise<number | undefined> {
  try {
    const raw = (await readFile(daemonPidPath(), "utf8")).trim();
    const pid = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}