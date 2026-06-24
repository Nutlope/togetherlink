import http, { type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { once } from "node:events";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CLAUDE_LOCAL_PROXY_HOST } from "../claude/defaults.js";
import {
  handleProxyRequest,
  requestPath,
  readJsonBody,
  writeJson,
  writeAnthropicError,
  isTogetherApiError,
  extractToken,
} from "../claude/proxy.js";
import { handleCodexProxyRequest } from "../codex/proxy.js";
import {
  sessions,
  buildSession,
  toPublicSessionView,
  type RegisterSessionRequest,
  type UsageReportRequest,
  isProxiedAgent,
} from "./state.js";

export const DEFAULT_DAEMON_PORT = 7878;

/** How often the daemon sweeps for sessions whose launcher has died. */
const SESSION_REAP_INTERVAL_MS = 30_000;

// Static route patterns, hoisted so they're compiled once rather than
// re-allocated on every request (the /v1/* hot path evaluates them first).
const COST_ROUTE = /^\/internal\/sessions\/([^/]+)\/cost$/;
const PID_ROUTE = /^\/internal\/sessions\/([^/]+)\/pid$/;
const USAGE_ROUTE = /^\/internal\/sessions\/([^/]+)\/usage$/;
const SESSION_ROUTE = /^\/internal\/sessions\/([^/]+)$/;

/**
 * Where the launcher and daemon agree the daemon's pid file lives. Honors
 * `TOGETHERLINK_HOME` (matching autoupdate.ts/install.sh's install dir) so a
 * user with a custom install home keeps the pid file alongside the bundle.
 */
export function daemonPidPath(home = resolveTogetherlinkHome()): string {
  return path.join(home, "daemon.pid");
}

function resolveTogetherlinkHome(): string {
  return process.env.TOGETHERLINK_HOME || path.join(os.homedir(), ".togetherlink");
}

export function resolveDaemonPort(): number {
  const raw = process.env.TOGETHERLINK_PORT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAEMON_PORT;
}

export function daemonUrl(port = resolveDaemonPort()): string {
  return `http://${CLAUDE_LOCAL_PROXY_HOST}:${port}`;
}

type DaemonOptions = {
  debug?: boolean;
};

/**
 * Bind the daemon server to its fixed port. If the port is already in use,
 * it's almost always a concurrent-spawn race: another launcher already brought
 * a healthy daemon up on this port. In that case exit 0 silently so only one
 * daemon survives. If the squatter isn't a healthy daemon, exit 1 with a clear
 * message (we don't try to kill the other process).
 */
async function listenOrExitOnRace(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Don't reject here; handle the race after removing the listener.
        server.removeListener("error", onError);
        void probeHealthz(port).then((healthy) => {
          if (healthy) {
            process.exit(0);
          }
          process.stderr.write(`[togetherlink daemon] port ${port} in use by a non-daemon process.\n`);
          process.exit(1);
        });
        return;
      }
      server.removeListener("error", onError);
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, CLAUDE_LOCAL_PROXY_HOST, () => {
      server.removeListener("error", onError);
      resolve();
    });
  });
}

/**
 * Run the shared, persistent proxy daemon. One process serves every
 * `togetherlink claude` session: each registers its token + credentials at
 * `POST /internal/sessions`, and the daemon resolves every `/v1/*` request to
 * that session (and its CostTracker) by the presented Bearer token. Runs
 * forever — the http server keeps the event loop alive — until SIGTERM/SIGINT.
 */
export async function runDaemon(options: DaemonOptions = {}): Promise<void> {
  const port = resolveDaemonPort();
  const debug = options.debug ?? process.env.TOGETHERLINK_DEBUG === "1";
  const restored = await sessions.restorePersisted();

  const server = http.createServer((req, res) => {
    handleDaemonRequest(req, res, { debug }).catch((err: unknown) => {
      if (isTogetherApiError(err)) {
        writeAnthropicError(res, err.anthropicStatus, err.anthropicType, err.message);
        return;
      }
      writeAnthropicError(res, 500, "api_error", err instanceof Error ? err.message : String(err));
    });
  });

  await listenOrExitOnRace(server, port);

  await mkdir(path.dirname(daemonPidPath()), { recursive: true });
  await writeFile(daemonPidPath(), `${process.pid}\n`, { encoding: "utf8" });
  if (debug) {
    process.stderr.write(`[togetherlink daemon] listening: ${daemonUrl(port)} (pid ${process.pid})\n`);
    if (restored > 0) {
      process.stderr.write(`[togetherlink daemon] restored ${restored} active session(s).\n`);
    }
  }

  let closing = false;
  // Periodically reap sessions whose launcher (claude child) has died without
  // deregistering — e.g. the launcher was kill -9'd. Keeps the registry from
  // growing without bound over the daemon's lifetime.
  const reaper = setInterval(() => {
    const removed = sessions.reapDead();
    if (debug && removed > 0) {
      process.stderr.write(`[togetherlink daemon] reaped ${removed} dead session(s).\n`);
    }
  }, SESSION_REAP_INTERVAL_MS);
  reaper.unref();

  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) {
      return;
    }
    closing = true;
    clearInterval(reaper);
    if (debug) {
      process.stderr.write(`[togetherlink daemon] ${signal} — shutting down.\n`);
    }
    sessions.closeStore();
    server.close();
    try {
      await unlink(daemonPidPath());
    } catch {
      // pid file already gone; fine.
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep the process alive for the lifetime of the server. `server.listen`
  // already does this, but be explicit: the daemon must never fall through.
  await once(server, "close");
}

type DaemonRequestOptions = {
  debug: boolean;
};

async function handleDaemonRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: DaemonRequestOptions,
): Promise<void> {
  const path_ = requestPath(req);
  if (opts.debug) {
    process.stderr.write(`[togetherlink daemon] ${req.method} ${path_}\n`);
  }

  // Unauthenticated liveness + health (must work before any session exists).
  if (req.method === "HEAD" && path_ === "/") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "GET" && path_ === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && path_ === "/") {
    writeDashboardHtml(res);
    return;
  }

  if (req.method === "GET" && path_ === "/dashboard.js") {
    writeDashboardScript(res);
    return;
  }

  if (req.method === "GET" && path_ === "/favicon.ico") {
    writeFavicon(res);
    return;
  }

  if (req.method === "GET" && path_ === "/internal/dashboard") {
    const snapshot = sessions.dashboardSnapshot();
    writeJson(res, 200, {
      generatedAt: snapshot.generatedAt,
      daemon: { port: resolveDaemonPort(), url: daemonUrl() },
      totals: snapshot.totals,
      sessions: snapshot.sessions,
    });
    return;
  }

  // Internal session-management endpoints. Loopback binding is the boundary
  // (same trust model as today's single-session proxy, which has no internal
  // secret either). Used only by `togetherlink` itself.
  if (path_ === "/internal/sessions") {
    if (req.method === "POST") {
      await registerSession(req, res);
      return;
    }
    if (req.method === "GET") {
      // Return only an aggregate count + per-session metadata, NOT the session
      // tokens: the token is the only secret gating a session's /v1/* requests
      // (it authorizes billing against that session's Together apiKey), so
      // publishing it here would let any local loopback process harvest a
      // victim's token and impersonate their session. `daemon status` and the
      // dashboard only need the count + agent/modelLabel/started. Per-session
      // detail (cost/delete/usage) is keyed by a token only the owning launcher
      // knows.
      writeJson(res, 200, {
        count: sessions.size,
        sessions: sessions.list().map(toPublicSessionView),
      });
      return;
    }
    writeAnthropicError(res, 405, "method_not_allowed", `Unsupported method ${req.method ?? ""}`);
    return;
  }

  const costMatch = path_.match(COST_ROUTE);
  if (costMatch && req.method === "GET") {
    const state = sessions.get(decodeURIComponent(costMatch[1] as string));
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    writeJson(res, 200, { summary: state.costTracker.summarize() });
    return;
  }

  const usageMatch = path_.match(USAGE_ROUTE);
  if (usageMatch && req.method === "POST") {
    const state = sessions.get(decodeURIComponent(usageMatch[1] as string));
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    const body = (await readJsonBody(req)) as UsageReportRequest;
    const promptTokens = typeof body?.promptTokens === "number" ? body.promptTokens : 0;
    const completionTokens = typeof body?.completionTokens === "number" ? body.completionTokens : 0;
    const cachedTokens = typeof body?.cachedTokens === "number" ? body.cachedTokens : 0;
    // Self-reported cost (e.g. OpenCode at exit, which goes direct to Together
    // and so isn't accounted by the proxy path). Account once against this
    // session's tracker so the cost endpoint + dashboard show it uniformly.
    if (promptTokens > 0 || completionTokens > 0) {
      state.costTracker.addUsage(promptTokens, cachedTokens, completionTokens, state.modelDefinition);
    }
    if (typeof body?.summary === "string" && body.summary) {
      state.costTracker.setExternalSummary(body.summary);
    }
    sessions.updateUsage(state.token, typeof body?.summary === "string" && body.summary ? body.summary : undefined);
    writeJson(res, 200, { ok: true });
    return;
  }

  const pidMatch = path_.match(PID_ROUTE);
  if (pidMatch && req.method === "POST") {
    const token = decodeURIComponent(pidMatch[1] as string);
    const state = sessions.get(token);
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    const body = (await readJsonBody(req)) as { pid?: number };
    if (typeof body?.pid === "number") {
      sessions.updatePid(token, body.pid);
    }
    writeJson(res, 200, { ok: true });
    return;
  }

  const deleteMatch = path_.match(SESSION_ROUTE);
  if (deleteMatch && req.method === "DELETE") {
    const removed = sessions.delete(decodeURIComponent(deleteMatch[1] as string));
    writeJson(res, removed ? 200 : 404, removed ? { ok: true } : { ok: false });
    return;
  }

  // Everything below is a proxied-agent-facing request that must belong to a
  // session. Self-reporting agents (OpenCode) never send traffic here — they go
  // direct to Together — so a request carrying their token is a
  // misconfiguration; refuse it clearly.
  const sessionRoute = localSessionRoute(req, path_);
  const token = sessionRoute?.token ?? extractToken(req);
  const session = token !== undefined ? sessions.get(token) : undefined;
  if (!session) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }
  if (!isProxiedAgent(session.agent) || session.options === undefined) {
    writeAnthropicError(
      res,
      404,
      "not_found_error",
      `This session's agent (${session.agent}) is not proxied by the daemon.`,
    );
    return;
  }

  if (session.agent === "codex") {
    try {
      await handleCodexProxyRequest(req, res, session.options);
    } finally {
      sessionRoute?.restore();
    }
    return;
  }

  // Delegate to the Claude proxy request handler with this session's options
  // (its authToken + CostTracker + model fields), so every downstream function
  // keeps working unchanged.
  try {
    await handleProxyRequest(req, res, session.options);
  } finally {
    sessionRoute?.restore();
  }
}

function localSessionRoute(
  req: IncomingMessage,
  path_: string,
): { token: string; restore: () => void } | undefined {
  const match = path_.match(/^\/session\/([^/]+)(\/.*)$/);
  if (!match) {
    return undefined;
  }
  const originalUrl = req.url;
  const url = new URL(req.url ?? path_, "http://127.0.0.1");
  url.pathname = match[2] as string;
  req.url = `${url.pathname}${url.search}`;
  return {
    token: decodeURIComponent(match[1] as string),
    restore: () => {
      req.url = originalUrl;
    },
  };
}

function writeDashboardHtml(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>togetherlink Dashboard</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <style>
    :root { color-scheme: light dark; --bg: #f6f5f1; --panel: #ffffff; --panel-soft: #fbfaf7; --text: #1d2327; --muted: #697279; --faint: #9aa1a7; --line: #dedbd1; --line-strong: #c9c5bb; --good: #08755f; --warn: #986800; --bad: #b42318; --codex: #2f5d8c; --claude: #b85f3f; --opencode: #171717; --chip: #efede7; }
    @media (prefers-color-scheme: dark) { :root { --bg: #101211; --panel: #181b1a; --panel-soft: #141716; --text: #eef1ef; --muted: #a6ada9; --faint: #737b76; --line: #303531; --line-strong: #454c47; --chip: #252a27; --opencode: #ecefeb; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    main { width: min(1280px, calc(100vw - 32px)); margin: 24px auto 56px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; line-height: 1.1; }
    h2 { margin: 0; font-size: 15px; line-height: 1.2; }
    button, summary { font: inherit; }
    .muted { color: var(--muted); }
    .faint { color: var(--faint); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .stat, .session { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 1px 2px rgba(17, 24, 39, .03); }
    .stat { padding: 12px 14px; }
    .stat b { display: block; font-size: 22px; margin-top: 1px; font-variant-numeric: tabular-nums; }
    .sessions { display: grid; gap: 12px; }
    .session { overflow: hidden; }
    .session summary { display: grid; grid-template-columns: minmax(260px, 1.45fr) repeat(5, minmax(92px, .6fr)) 26px; gap: 12px; align-items: center; padding: 13px 14px; cursor: pointer; list-style: none; }
    .session summary::-webkit-details-marker { display: none; }
    .session[open] summary { border-bottom: 1px solid var(--line); background: var(--panel-soft); }
    .session-summary { width: 100%; display: grid; grid-template-columns: minmax(260px, 1.45fr) repeat(5, minmax(92px, .6fr)) 26px; gap: 12px; align-items: center; padding: 13px 14px; cursor: pointer; border: 0; background: transparent; color: inherit; text-align: left; }
    .session[data-open=true] .session-summary { border-bottom: 1px solid var(--line); background: var(--panel-soft); }
    .session-title { display: flex; min-width: 0; align-items: center; gap: 10px; }
    .agent-icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--text); }
    .agent-icon svg { width: 20px; height: 20px; display: block; }
    .agent-icon[data-agent=claude] { color: var(--claude); }
    .agent-icon[data-agent=codex] { color: var(--codex); }
    .agent-icon[data-agent=opencode] { color: var(--opencode); }
    .session-name { min-width: 0; }
    .session-name h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-name .meta { margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; }
    .metric { min-width: 0; }
    .metric-label { display: block; color: var(--faint); font-size: 11px; font-weight: 650; letter-spacing: .02em; text-transform: uppercase; }
    .metric-value { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; font-variant-numeric: tabular-nums; }
    .toggle { color: var(--faint); transform: rotate(-90deg); transition: transform .14s ease; text-align: right; }
    .session[open] .toggle { transform: rotate(0deg); }
    .session[data-open=true] .toggle { transform: rotate(0deg); }
    .chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; background: var(--chip); padding: 2px 8px; color: var(--muted); font-size: 12px; white-space: nowrap; }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
    .running { color: var(--good); }
    .warn { color: var(--warn); }
    .ended, .error { color: var(--bad); }
    .session-body { padding: 14px; }
    .body-grid { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.35fr); gap: 12px; margin-bottom: 12px; }
    .panel { min-width: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-soft); padding: 12px; }
    .panel h3 { margin: 0 0 8px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .02em; }
    .kv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .kv div { min-width: 0; }
    .bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--chip); display: flex; margin: 8px 0 10px; }
    .bar span:first-child { background: var(--good); }
    .bar span:last-child { background: var(--warn); }
    .preview { margin: 0; max-height: 118px; overflow: auto; white-space: pre-wrap; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border-top: 1px solid var(--line); padding: 8px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; }
    .request-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; max-height: 3.1em; color: var(--muted); }
    .trace-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    .trace-table { min-width: 1180px; background: var(--panel); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .empty { background: var(--panel); border: 1px dashed var(--line); border-radius: 8px; padding: 28px; text-align: center; color: var(--muted); }
    .loading { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; color: var(--muted); }
    @media (max-width: 980px) { .session summary { grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(84px, .4fr)) 26px; } .hide-md { display: none; } .body-grid { grid-template-columns: 1fr; } }
    @media (max-width: 980px) { .session-summary { grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(84px, .4fr)) 26px; } }
    @media (max-width: 760px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } header { align-items: start; flex-direction: column; } .session summary { grid-template-columns: 1fr 26px; } .hide-sm { display: none; } .kv { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .session-summary { grid-template-columns: 1fr 26px; } }
  </style>
</head>
<body>
  <div id="dashboard-root"><main><div class="loading">Loading local sessions...</div></main></div>
  <script type="module" src="/dashboard.js"></script>
</body>
</html>`);
}

function writeDashboardScript(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`import React, { useEffect, useState } from "https://esm.sh/react@19.2.3";
import { createRoot } from "https://esm.sh/react-dom@19.2.3/client";

const e = React.createElement;
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const bytes = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const agentLabel = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode" };

function age(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  return Math.round(minutes / 60) + "h ago";
}

function formatBytes(value) {
  if (!value) return "-";
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return bytes.format(value / 1024) + " KB";
  return bytes.format(value / 1024 / 1024) + " MB";
}

function sessionKey(session) {
  return [session.agent, session.modelLabel, session.startedAt, session.pid || ""].join(":");
}

function lastTrace(session) {
  return session.traces && session.traces.length ? session.traces[0] : undefined;
}

function lastTraceWithUsage(session) {
  return session.traces ? session.traces.find((trace) => trace.usage && trace.usage.promptTokens > 0) : undefined;
}

function cachePercent(trace) {
  return trace && trace.usage && trace.usage.promptTokens > 0
    ? Math.round((trace.usage.cachedTokens / trace.usage.promptTokens) * 100)
    : undefined;
}

function prefixPercent(trace) {
  const profile = trace && trace.promptProfile;
  if (!profile || !profile.totalBytes) return undefined;
  return Math.round((profile.stablePrefixBytes / profile.totalBytes) * 100);
}

function cleanPreview(preview) {
  const lines = String(preview || "").split("\\n");
  const dynamic = lines.filter((line) => !/^(system|instructions|tools):/i.test(line.trim()));
  const chosen = dynamic.length ? dynamic : lines;
  return chosen.slice(-4).join("\\n").slice(0, 1400);
}

function traceTone(trace) {
  if (!trace || !trace.promptProfile) return "muted";
  const profile = trace.promptProfile;
  if (profile.dynamicBytes > profile.stablePrefixBytes * 2 && profile.dynamicBytes > 12000) return "warn";
  return "running";
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openByKey, setOpenByKey] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/internal/dashboard", { cache: "no-store" });
        if (!response.ok) throw new Error("Dashboard request failed: " + response.status);
        const next = await response.json();
        if (!cancelled) {
          setData(next);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    const timer = window.setInterval(load, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const subtitle = data ? "Updated " + new Date(data.generatedAt).toLocaleTimeString() : "Loading local sessions...";
  return e("main", null,
    e("header", null,
      e("div", null,
        e("h1", null, "togetherlink Dashboard"),
        e("div", { className: "muted" }, subtitle)
      ),
      e("div", { className: "muted" }, e("code", null, data ? data.daemon.url : window.location.origin))
    ),
    error ? e("div", { className: "empty" }, "Could not load dashboard: " + error) : null,
    data ? e(Stats, { totals: data.totals }) : e("div", { className: "loading" }, "Loading local sessions..."),
    data ? e(SessionList, {
      sessions: data.sessions,
      openByKey,
      setOpenByKey,
    }) : null
  );
}

function Stats({ totals }) {
  return e("section", { className: "grid" },
    e(Stat, { label: "Active sessions", value: totals.active }),
    e(Stat, { label: "Recent sessions", value: totals.recent }),
    e(Stat, { label: "Total sessions", value: totals.all }),
    e(Stat, { label: "Recorded traces", value: totals.traces })
  );
}

function Stat({ label, value }) {
  return e("div", { className: "stat" }, e("span", { className: "muted" }, label), e("b", null, value));
}

function SessionList({ sessions, openByKey, setOpenByKey }) {
  if (!sessions.length) {
    return e("section", { className: "sessions" },
      e("div", { className: "empty" }, "No sessions yet. Run togetherlink claude, togetherlink codex, or togetherlink opencode to start one.")
    );
  }
  return e("section", { className: "sessions" }, sessions.map((session) =>
    e(SessionCard, {
      key: sessionKey(session),
      session,
      openByKey,
      setOpenByKey,
    })
  ));
}

function SessionCard({ session, openByKey, setOpenByKey }) {
  const key = sessionKey(session);
  const trace = lastTrace(session);
  const usageTrace = lastTraceWithUsage(session);
  const explicitOpen = Object.prototype.hasOwnProperty.call(openByKey, key) ? openByKey[key] : undefined;
  const isOpen = explicitOpen === undefined ? session.status === "running" : explicitOpen;
  const metaLabel = agentLabel[session.agent] || session.agent || "Session";
  const cache = cachePercent(usageTrace);
  const prefix = prefixPercent(trace);
  const profile = trace && trace.promptProfile;
  const promptTone = traceTone(trace);
  const stableWidth = profile && profile.totalBytes ? Math.max(4, Math.min(96, (profile.stablePrefixBytes / profile.totalBytes) * 100)) : 0;
  const dynamicWidth = profile && profile.totalBytes ? Math.max(4, Math.min(96, (profile.dynamicBytes / profile.totalBytes) * 100)) : 0;
  const started = "Started " + age(session.startedAt) + (session.pid ? " - pid " + session.pid : "");
  const traceSummary = session.traceCount + " trace" + (session.traceCount === 1 ? "" : "s");
  const latestPreview = trace ? cleanPreview(trace.requestPreview) : "No proxied requests recorded yet.";

  function toggle() {
    setOpenByKey((current) => ({ ...current, [key]: !isOpen }));
  }

  return e("article", { className: "session", "data-open": String(isOpen) },
    e("button", { type: "button", className: "session-summary", onClick: toggle, "aria-expanded": isOpen },
      e("div", { className: "session-title" },
        e(AgentIcon, { agent: session.agent }),
        e("div", { className: "session-name" },
          e("h2", null, metaLabel + " - " + session.modelLabel),
          e("div", { className: "meta" }, started)
        )
      ),
      e(Metric, { className: "hide-sm", label: "Status", valueClassName: session.status, value: e(React.Fragment, null, e("span", { className: "dot" }), " ", session.status) }),
      e(Metric, { className: "hide-sm", label: "Requests", value: traceSummary }),
      e(Metric, { className: "hide-md", label: "Cache", value: cache === undefined ? "-" : cache + "%" }),
      e(Metric, { className: "hide-md", label: "Stable prefix", valueClassName: promptTone, value: prefix === undefined ? "-" : prefix + "%" }),
      e(Metric, { className: "hide-md", label: "Latest", value: trace ? age(trace.startedAt) : "-" }),
      e("div", { className: "toggle" }, "v")
    ),
    isOpen ? e("div", { className: "session-body" },
      e("div", { className: "body-grid" },
        e("section", { className: "panel" },
          e("h3", null, "Session"),
          e("div", { className: "kv" },
            e(KeyValue, { label: "Agent", value: metaLabel }),
            e(KeyValue, { label: "Model", value: session.modelLabel }),
            e(KeyValue, { label: "Cost", value: (session.costSummary || "-").split("\\n")[0] || "-" }),
            e(KeyValue, { label: "Messages", value: trace && trace.messageCount !== undefined ? trace.messageCount : "-" }),
            e(KeyValue, { label: "Tools", value: trace && trace.toolCount !== undefined ? trace.toolCount : "-" }),
            e(KeyValue, { label: "Native tools", value: trace && trace.nativeToolCount !== undefined ? trace.nativeToolCount : "-" })
          )
        ),
        e("section", { className: "panel" },
          e("h3", null, "Prompt Shape"),
          e("div", { className: "bar", title: "Stable prefix vs dynamic prompt bytes" },
            e("span", { style: { width: stableWidth + "%" } }),
            e("span", { style: { width: dynamicWidth + "%" } })
          ),
          e("div", { className: "kv" },
            e(KeyValue, { label: "Stable prefix", value: profile ? formatBytes(profile.stablePrefixBytes) : "-" }),
            e(KeyValue, { label: "Dynamic", valueClassName: promptTone, value: profile ? formatBytes(profile.dynamicBytes) : "-" }),
            e(KeyValue, { label: "Total", value: profile ? formatBytes(profile.totalBytes) : "-" })
          )
        )
      ),
      e("section", { className: "panel" },
        e("h3", null, "Latest Dynamic Preview"),
        e("pre", { className: "preview" }, latestPreview)
      ),
      session.traces.length ? e(TraceTable, { traces: session.traces }) : e("div", { className: "empty" }, "No proxied requests recorded yet. OpenCode sessions self-report cost at exit, so they may not have request traces.")
    ) : null
  );
}

function Metric({ className, label, value, valueClassName }) {
  return e("div", { className: ["metric", className].filter(Boolean).join(" ") },
    e("span", { className: "metric-label" }, label),
    e("span", { className: ["metric-value", valueClassName].filter(Boolean).join(" ") }, value)
  );
}

function KeyValue({ label, value, valueClassName }) {
  return e("div", null,
    e("span", { className: "metric-label" }, label),
    e("span", { className: ["metric-value", valueClassName].filter(Boolean).join(" ") }, value)
  );
}

function TraceTable({ traces }) {
  return e("div", { className: "trace-table-wrap" },
    e("table", { className: "trace-table" },
      e("thead", null, e("tr", null,
        ["time", "status", "total", "TTFT", "upstream", "out/s", "cache", "prompt mix", "size", "hash", "model", "request", "usage", "error"].map((heading) => e("th", { key: heading }, heading))
      )),
      e("tbody", null, traces.map((trace) => e(TraceRow, { key: trace.id, trace })))
    )
  );
}

function TraceRow({ trace }) {
  const usage = trace.usage ? fmt.format(trace.usage.promptTokens) + " in / " + fmt.format(trace.usage.completionTokens) + " out / " + money.format(trace.usage.costUsd) : "-";
  const elapsedMs = trace.durationMs ?? Math.max(0, Date.now() - trace.startedAt);
  const status = trace.ok === undefined ? e("span", { className: "chip" }, "pending") : trace.ok ? e("span", { className: "running" }, "ok") : e("span", { className: "error" }, "error");
  const ttftMs = trace.firstByteAt ? trace.firstByteAt - trace.startedAt : trace.upstreamHeadersAt ? trace.upstreamHeadersAt - trace.startedAt : undefined;
  const decodeMs = trace.firstByteAt && (trace.completedAt || trace.durationMs) ? Math.max(1, (trace.completedAt ?? (trace.startedAt + trace.durationMs)) - trace.firstByteAt) : undefined;
  const outputPerSecond = trace.usage && decodeMs ? fmt.format(trace.usage.completionTokens / (decodeMs / 1000)) + "/s" : "-";
  const cachedPercent = trace.usage && trace.usage.promptTokens > 0 ? Math.round((trace.usage.cachedTokens / trace.usage.promptTokens) * 100) + "%" : "-";
  const upstreamWait = trace.upstreamHeadersAt && trace.upstreamStartedAt ? ((trace.upstreamHeadersAt - trace.upstreamStartedAt) / 1000).toFixed(1) + "s" : "-";
  const firstByte = ttftMs !== undefined ? (ttftMs / 1000).toFixed(1) + "s" : "-";
  const profile = trace.promptProfile;
  const promptMix = profile ? formatBytes(profile.stablePrefixBytes) + " stable / " + formatBytes(profile.dynamicBytes) + " dynamic" : "-";
  const cacheKey = trace.cacheKey ? ["sys " + (trace.cacheKey.systemHash || "-"), "tools " + (trace.cacheKey.toolsHash || "-"), "msgs " + (trace.cacheKey.messagesHash || "-"), "full " + (trace.cacheKey.fullHash || "-")].join("\\n") : "";
  const hashCell = trace.cacheKey ? e("code", { title: cacheKey }, (trace.cacheKey.fullHash || "-").slice(0, 8)) : "-";
  return e("tr", null,
    e("td", null, e("code", null, new Date(trace.startedAt).toLocaleTimeString())),
    e("td", null, status),
    e("td", null, (elapsedMs / 1000).toFixed(1) + "s"),
    e("td", null, firstByte),
    e("td", null, upstreamWait),
    e("td", null, outputPerSecond),
    e("td", null, cachedPercent),
    e("td", null, promptMix),
    e("td", null, formatBytes(trace.requestBytes)),
    e("td", null, hashCell),
    e("td", null, trace.model || "-"),
    e("td", null, e("div", { className: "request-preview", title: trace.requestPreview || "" }, cleanPreview(trace.requestPreview) || "-")),
    e("td", null, usage),
    e("td", null, trace.error || "-")
  );
}

function AgentIcon({ agent }) {
  if (agent === "claude") {
    return e("span", { className: "agent-icon", "data-agent": agent, title: agentLabel[agent] },
      e("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" },
        e("path", { fill: "currentColor", d: "M4.7 15.8 9.4 13l.2-.4-.2-.3h-.3l-2.7-.1-2.4-.1-2.3-.1-.5-.1-.5-.7.1-.4.5-.3.7.1 3.8.3 3.7.4h.4l.1-.2-.2-.1-4.8-3.2-2.5-1.8-.7-.9-.1-1 .7-.7.9.1.2.1 4.4 3.4 2.7 2 .2-.1.1-.1-.2-.3-2.7-4.9-.7-1.1-.2-.7.1-1 .4-.2 1 .1.4.4 3 6.4.4.9h.2V6.7l.5-5 .4-.9.8-.5.6.3.5.7-.1.5-.8 5.2-.4 2h.2l.2-.2 3.5-4.5.8-.8.5-.4h1l.8 1.1-.3 1.2-2.3 3-1.2 1.7.1.1.2-.1 4.6-1 1.8-.3.8.4.1.4-.3.8-5.7 1.2h-.1l.1.1 1.5.1h1.6l3 .2.8.5.5.6-.1.5-1.2.6-1.6-.4-5.2-1.2h-.2v.1l3.6 3.3 2.5 2.3.1.6-.3.5-.3-.1-4.7-3.5h-.1v.2l2.8 4.2.1 1.1-.2.3-.6.2-.7-.1-2.8-4.1-1.3-2.3-.2.1-.7 7.1-.3.4-.8.1-.6-.5-.3-.7.7-3.4.4-2.1.2-.6h-.2L8.1 21l-1.7 1.8-.4.2-.7-.4.1-.7.4-.6 2.4-3 1.4-1.9h-.1l-6.3 2.8-1.1.1-.5-.4.1-.7.2-.2 2.8-1.7z" })
      )
    );
  }
  if (agent === "codex") {
    return e("span", { className: "agent-icon", "data-agent": agent, title: agentLabel[agent] },
      e("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        e("path", { d: "M4.5 7.5 12 3l7.5 4.5v9L12 21l-7.5-4.5v-9Z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }),
        e("path", { d: "m8.2 9.7-2.4 2.4 2.4 2.4M15.8 9.7l2.4 2.4-2.4 2.4M13.4 8.6l-2.8 6.8", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" })
      )
    );
  }
  return e("span", { className: "agent-icon", "data-agent": agent || "opencode", title: agentLabel[agent] || "Session" },
    e("svg", { viewBox: "0 0 24 30", "aria-hidden": "true" },
      e("path", { d: "M18 24H6V12h12v12Z", fill: "#cfcecd" }),
      e("path", { d: "M18 6H6v18h12V6Zm6 24H0V0h24v30Z", fill: "currentColor" })
    )
  );
}

createRoot(document.getElementById("dashboard-root")).render(e(App));
`);
}

function writeFavicon(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
  res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#111312"/>
  <path d="M18 20h28v6H35v20h-6V26H18z" fill="#f7f7f5"/>
  <path d="M42 34h8v6h-8zM14 34h8v6h-8z" fill="#3dd6b4"/>
</svg>`);
}

async function registerSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as RegisterSessionRequest;
  // Agent-neutral core: every session needs a non-empty token + apiKey, a
  // modelDefinition (for CostTracker pricing), and a display modelLabel.
  const coreMissing =
    !body ||
    typeof body.token !== "string" || !body.token ||
    typeof body.apiKey !== "string" || !body.apiKey ||
    typeof body.modelLabel !== "string" || !body.modelLabel ||
    typeof body.modelDefinition !== "object" ||
    body.modelDefinition === null;
  if (coreMissing) {
    writeAnthropicError(
      res,
      400,
      "invalid_request_error",
      "Malformed register body: requires token, apiKey, modelLabel, modelDefinition.",
    );
    return;
  }
  // Proxied agents (Claude) also need the model alias fields for the proxy's
  // model menu + per-request routing. Self-reporting agents (OpenCode) don't.
  const agent = body.agent ?? "claude";
  if (isProxiedAgent(agent)) {
    const proxyMissing =
      typeof body.modelId !== "string" || !body.modelId ||
      typeof body.targetModelId !== "string" || !body.targetModelId;
    if (proxyMissing) {
      writeAnthropicError(
        res,
        400,
        "invalid_request_error",
        `Agent "${agent}" is proxied and requires modelId + targetModelId.`,
      );
      return;
    }
  }
  const state = buildSession(body);
  sessions.register(state);
  writeJson(res, 200, {
    ok: true,
    session: {
      agent: state.agent,
      modelLabel: state.modelLabel,
      ...(state.pid !== undefined ? { pid: state.pid } : {}),
      startedAt: state.startedAt,
    },
  });
}

/**
 * Best-effort health probe. Exported so the launcher (`launch.ts`) and the
 * `daemon status` command can reuse it. Resolves false on any failure (refused,
 * timeout, non-200) rather than rejecting.
 */
export async function probeHealthz(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300);
    const response = await fetch(`${daemonUrl(port)}/healthz`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}
