import { readFile, unlink } from "node:fs/promises";
import { resolveDaemonPort, daemonUrl, daemonPidPath } from "./server.js";

/**
 * `togetherlink daemon stop` plus the internal `serve` entrypoint used by the
 * launcher.
 */
export async function runDaemonCommand(verb: string | undefined): Promise<void> {
  const resolved = verb;
  if (resolved === "stop") {
    await daemonStop();
    return;
  }
  if (resolved === "serve") {
    const { runDaemon } = await import("./server.js");
    await runDaemon();
    return;
  }
  throw new Error(`Unknown "daemon ${verb ?? ""}" command. Expected: stop.`);
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
