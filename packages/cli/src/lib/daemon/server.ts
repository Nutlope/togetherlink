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

  if (req.method === "GET" && path_ === "/favicon.ico") {
    writeFavicon(res);
    return;
  }

  if (req.method === "GET" && path_ === "/internal/dashboard") {
    const active = sessions.list().map(toPublicSessionView);
    const recent = sessions.listRecent().map(toPublicSessionView);
    writeJson(res, 200, {
      generatedAt: Date.now(),
      daemon: { port: resolveDaemonPort(), url: daemonUrl() },
      totals: {
        active: active.length,
        recent: recent.length,
        all: active.length + recent.length,
        traces: [...active, ...recent].reduce((sum, session) => sum + session.traceCount, 0),
      },
      sessions: [...active, ...recent],
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
    :root { color-scheme: light dark; --bg: #f7f7f5; --panel: #ffffff; --text: #1f2328; --muted: #667085; --line: #d8d8d2; --good: #12715b; --bad: #b42318; --chip: #edf2f7; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111312; --panel: #191c1b; --text: #eef1ef; --muted: #a5aca8; --line: #303633; --chip: #242a27; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(1180px, calc(100vw - 32px)); margin: 28px auto 56px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 15px; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat, .session { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .stat b { display: block; font-size: 24px; margin-top: 2px; }
    .sessions { display: grid; gap: 12px; }
    .session-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .title { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .chip { border-radius: 999px; background: var(--chip); padding: 2px 8px; color: var(--muted); font-size: 12px; }
    .running { color: var(--good); }
    .ended, .error { color: var(--bad); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border-top: 1px solid var(--line); padding: 8px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; }
    .request-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; max-height: 4.5em; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .empty { background: var(--panel); border: 1px dashed var(--line); border-radius: 8px; padding: 28px; text-align: center; color: var(--muted); }
    @media (max-width: 760px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } header { align-items: start; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>togetherlink Dashboard</h1>
        <div class="muted" id="subtitle">Loading local sessions...</div>
      </div>
      <div class="muted"><code>http://127.0.0.1:${resolveDaemonPort()}</code></div>
    </header>
    <section class="grid" id="stats"></section>
    <section class="sessions" id="sessions"></section>
  </main>
  <script>
    const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
    function age(ms) {
      const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
      if (seconds < 60) return seconds + 's ago';
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return minutes + 'm ago';
      return Math.round(minutes / 60) + 'h ago';
    }
    function stat(label, value) {
      return '<div class="stat"><span class="muted">' + label + '</span><b>' + value + '</b></div>';
    }
    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    }
    function traceRow(trace) {
      const usage = trace.usage ? fmt.format(trace.usage.promptTokens) + ' in / ' + fmt.format(trace.usage.completionTokens) + ' out / ' + money.format(trace.usage.costUsd) : '-';
      const elapsedMs = trace.durationMs ?? Math.max(0, Date.now() - trace.startedAt);
      const seconds = elapsedMs / 1000;
      const status = trace.ok === undefined ? '<span class="chip">pending</span>' : trace.ok ? '<span class="running">ok</span>' : '<span class="error">error</span>';
      const outputPerSecond = trace.usage && seconds > 0 ? fmt.format(trace.usage.completionTokens / seconds) + '/s' : '-';
      return '<tr><td><code>' + new Date(trace.startedAt).toLocaleTimeString() + '</code></td><td>' + status + '</td><td>' + seconds.toFixed(1) + 's</td><td>' + outputPerSecond + '</td><td>' + esc(trace.model || '-') + '</td><td><div class="request-preview" title="' + esc(trace.requestPreview || '') + '">' + esc(trace.requestPreview || '-') + '</div></td><td>' + usage + '</td><td>' + esc(trace.error || '-') + '</td></tr>';
    }
    function sessionCard(session) {
      const traces = session.traces.length ? '<table><thead><tr><th>time</th><th>status</th><th>latency</th><th>tok/sec</th><th>model</th><th>request</th><th>usage</th><th>error</th></tr></thead><tbody>' + session.traces.map(traceRow).join('') + '</tbody></table>' : '<div class="muted">No proxied requests recorded yet.</div>';
      return '<article class="session"><div class="session-head"><div><div class="title"><h2>' + esc(session.agent) + '</h2><span class="chip">' + esc(session.modelLabel) + '</span><span class="' + session.status + '">' + session.status + '</span></div><div class="muted">Started ' + age(session.startedAt) + (session.pid ? ' · pid ' + session.pid : '') + '</div></div><code>' + session.traceCount + ' trace' + (session.traceCount === 1 ? '' : 's') + '</code></div><p class="muted">' + esc(session.costSummary).replaceAll('\\n', '<br>') + '</p>' + traces + '</article>';
    }
    async function load() {
      const data = await fetch('/internal/dashboard', { cache: 'no-store' }).then(r => r.json());
      document.getElementById('subtitle').textContent = 'Updated ' + new Date(data.generatedAt).toLocaleTimeString();
      document.getElementById('stats').innerHTML = stat('Active sessions', data.totals.active) + stat('Recent sessions', data.totals.recent) + stat('Total sessions', data.totals.all) + stat('Recorded traces', data.totals.traces);
      document.getElementById('sessions').innerHTML = data.sessions.length ? data.sessions.map(sessionCard).join('') : '<div class="empty">No sessions yet. Run togetherlink claude or togetherlink codex to start one.</div>';
    }
    load().catch(err => { document.getElementById('sessions').innerHTML = '<div class="empty">Could not load dashboard: ' + err.message + '</div>'; });
    setInterval(load, 2000);
  </script>
</body>
</html>`);
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
