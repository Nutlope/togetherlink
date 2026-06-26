import { readFile, unlink } from "node:fs/promises";
import type { ProxyTraceEvent } from "../proxy-trace.js";
import { probeHealthz, resolveDaemonPort, daemonUrl, daemonPidPath } from "./server.js";

type ProfileSession = {
  agent?: string;
  modelLabel?: string;
  startedAt?: number;
  traces?: ProxyTraceEvent[];
};

type DashboardResponse = {
  sessions?: ProfileSession[];
};

/**
 * `togetherlink status daemon` / `togetherlink daemon stop`. These are thin
 * user-facing controls over the shared proxy daemon; the daemon itself is
 * started lazily by `togetherlink claude` via `ensureDaemon`.
 */
export async function runDaemonCommand(verb: string | undefined): Promise<void> {
  const resolved = verb ?? "status";
  if (resolved === "status") {
    await daemonStatus();
    return;
  }
  if (resolved === "profile") {
    await daemonProfile();
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
  throw new Error(`Unknown "daemon ${verb ?? ""}" command. Expected: status, profile, stop.`);
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

async function daemonProfile(): Promise<void> {
  const port = resolveDaemonPort();
  const healthy = await probeHealthz(port);
  if (!healthy) {
    console.log(`togetherlink codex profile: daemon is not running on ${daemonUrl(port)}.`);
    console.log('Run `tcodex exec "Say hi"` or `togetherlink codex`, then rerun this command.');
    return;
  }

  const response = await fetch(`${daemonUrl(port)}/internal/dashboard`);
  if (!response.ok) {
    throw new Error(`Daemon dashboard returned HTTP ${response.status}.`);
  }
  const body = (await response.json()) as DashboardResponse;
  const sessions = (body.sessions ?? []).filter((session) => session.agent === "codex");
  const traces = sessions
    .flatMap((session) => (session.traces ?? []).map((trace) => ({ trace, session })))
    .sort((a, b) => b.trace.startedAt - a.trace.startedAt);

  if (traces.length === 0) {
    console.log("togetherlink codex profile: no Codex proxy traces recorded yet.");
    console.log('Run `tcodex exec "Say hi"` or a coding task, then rerun `togetherlink daemon profile`.');
    return;
  }

  const completed = traces.filter(({ trace }) => trace.ok === true);
  const failed = traces.filter(({ trace }) => trace.ok === false);
  const profileTraces = traces.map(({ trace }) => trace).filter((trace) => trace.promptProfile !== undefined);
  const usageTraces = traces.map(({ trace }) => trace).filter((trace) => trace.usage !== undefined);
  const promptBytes = sum(profileTraces, (trace) => trace.promptProfile?.totalBytes ?? 0);
  const stableBytes = sum(profileTraces, (trace) => trace.promptProfile?.stablePrefixBytes ?? 0);
  const dynamicBytes = sum(profileTraces, (trace) => trace.promptProfile?.dynamicBytes ?? 0);
  const promptTokens = sum(usageTraces, (trace) => trace.usage?.promptTokens ?? 0);
  const cachedTokens = sum(usageTraces, (trace) => trace.usage?.cachedTokens ?? 0);
  const completionTokens = sum(usageTraces, (trace) => trace.usage?.completionTokens ?? 0);
  const costUsd = sum(usageTraces, (trace) => trace.usage?.costUsd ?? 0);
  const toolTotal = sum(traces, ({ trace }) => trace.toolCount ?? 0);
  const nativeToolTotal = sum(traces, ({ trace }) => trace.nativeToolCount ?? 0);

  console.log("togetherlink Codex speed profile");
  console.log(`Daemon: ${daemonUrl(port)}`);
  console.log(
    `Sessions: ${sessions.length} Codex session${sessions.length === 1 ? "" : "s"}; requests: ${traces.length} (${completed.length} ok, ${failed.length} failed)`,
  );
  console.log("");
  console.log("Latency");
  console.log(
    `  total request:   p50 ${formatMs(percentile(latencies(traces, "total"), 50))} / p95 ${formatMs(percentile(latencies(traces, "total"), 95))}`,
  );
  console.log(
    `  time to first:   p50 ${formatMs(percentile(latencies(traces, "firstByte"), 50))} / p95 ${formatMs(percentile(latencies(traces, "firstByte"), 95))}`,
  );
  console.log(
    `  upstream wait:   p50 ${formatMs(percentile(latencies(traces, "upstream"), 50))} / p95 ${formatMs(percentile(latencies(traces, "upstream"), 95))}`,
  );
  console.log("");
  console.log("Prompt/cache");
  console.log(`  prompt bytes:    ${formatBytes(promptBytes)} (${percent(stableBytes, promptBytes)} stable / ${percent(dynamicBytes, promptBytes)} dynamic)`);
  console.log(`  tools:           ${toolTotal} total, ${nativeToolTotal} native (${average(toolTotal, traces.length).toFixed(1)} per request)`);
  console.log(`  tokens:          ${promptTokens} in / ${completionTokens} out / ${percent(cachedTokens, promptTokens)} cached`);
  console.log(`  estimated cost:  $${costUsd.toFixed(4)}`);
  console.log("");
  console.log("Recent requests");
  for (const { trace, session } of traces.slice(0, 5)) {
    const age = formatAge(Date.now() - trace.startedAt);
    const total = formatMs(trace.durationMs);
    const firstByte = formatMs(trace.firstByteAt ? trace.firstByteAt - trace.startedAt : undefined);
    const upstream = formatMs(
      trace.upstreamHeadersAt !== undefined && trace.upstreamStartedAt !== undefined
        ? trace.upstreamHeadersAt - trace.upstreamStartedAt
        : undefined,
    );
    const status = trace.ok === undefined ? "pending" : trace.ok ? "ok" : "error";
    const model = trace.model ?? session.modelLabel ?? "unknown-model";
    const profile = trace.promptProfile ? formatBytes(trace.promptProfile.totalBytes) : "-";
    console.log(
      `  ${age.padStart(6)} ${status.padEnd(7)} total ${total.padStart(7)} first ${firstByte.padStart(7)} upstream ${upstream.padStart(7)} prompt ${profile.padStart(8)} tools ${trace.toolCount ?? 0} model ${model}`,
    );
  }
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

function latencies(
  traces: Array<{ trace: ProxyTraceEvent }>,
  kind: "total" | "firstByte" | "upstream",
): number[] {
  return traces.flatMap(({ trace }) => {
    if (kind === "total") {
      return typeof trace.durationMs === "number" ? [trace.durationMs] : [];
    }
    if (kind === "firstByte") {
      return typeof trace.firstByteAt === "number" ? [trace.firstByteAt - trace.startedAt] : [];
    }
    if (typeof trace.upstreamHeadersAt === "number" && typeof trace.upstreamStartedAt === "number") {
      return [trace.upstreamHeadersAt - trace.upstreamStartedAt];
    }
    return [];
  });
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

function average(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

function percentile(values: number[], percentileRank: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1));
  return sorted[index];
}

function formatMs(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }
  return `${Math.round(value)}B`;
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) {
    return "-";
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) {
    return `${Math.max(0, Math.round(ageMs / 1000))}s`;
  }
  if (ageMs < 3_600_000) {
    return `${Math.round(ageMs / 60_000)}m`;
  }
  return `${Math.round(ageMs / 3_600_000)}h`;
}
