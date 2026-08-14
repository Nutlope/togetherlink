import http, { type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { once } from "node:events";
import { statSync } from "node:fs";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { WebSocketServer } from "ws";
import { VERSION } from "../version.js";
import { CLAUDE_LOCAL_PROXY_HOST } from "../claude/defaults.js";
import { extractToken, readJsonBody, requestPath, writeJson } from "../http-util.js";
import { handleProxyRequest } from "../claude/proxy.js";
import { writeAnthropicError, isTogetherApiError } from "../claude/together-call.js";
import {
  handleCodexProxyRequest,
  writeOpenAIError,
  type CodexProxyOptions,
} from "../codex/proxy.js";
import { handleCodexResponsesWebsocket } from "../codex/responses-websocket.js";
import { CodexRequestError } from "../codex/native-router.js";
import { isCodexResponsesWebsocketPath } from "../codex/routes.js";
import { CodexTogetherError } from "../codex/together-call.js";
import { TogetherResponseHeaderTimeoutError } from "../together-client.js";
import { readAppRegistration } from "./app-registration.js";
import { togetherlinkHome } from "../paths.js";
import {
  sessions as defaultSessions,
  SessionRegistry,
  buildSession,
  toPublicSessionView,
  type RegisterSessionRequest,
  type SessionState,
  type UsageReportRequest,
  isProxiedAgent,
} from "./state.js";

/** Active registry — runDaemon may override this with an injected one. */
let activeSessions: SessionRegistry = defaultSessions;

/**
 * Stateless WS handshake helper (`noServer: true` never binds its own socket),
 * so one instance is safely shared across every `runDaemon()` call/http.Server.
 */
const responsesWebsocketServer = new WebSocketServer({ noServer: true });

const DEFAULT_DAEMON_PORT = 7878;

/** How often the daemon sweeps for sessions whose launcher has died. */
const SESSION_REAP_INTERVAL_MS = 30_000;

// Static route patterns, hoisted so they're compiled once rather than
// re-allocated on every request (the /v1/* hot path evaluates them first).
const COST_ROUTE = /^\/internal\/sessions\/([^/]+)\/cost$/;
const PID_ROUTE = /^\/internal\/sessions\/([^/]+)\/pid$/;
const USAGE_ROUTE = /^\/internal\/sessions\/([^/]+)\/usage$/;
const SESSION_ROUTE = /^\/internal\/sessions\/([^/]+)$/;
const RUNNING_DAEMON_IDENTITY = daemonIdentityAtStartup();

export type DaemonHealth = {
  ok: true;
  pid: number;
  version: string;
  home: string | null;
  scriptPath: string | null;
  scriptSize: number | null;
  scriptMtimeMs: number | null;
  activeSessionCount: number;
};

/**
 * Where the launcher and daemon agree the daemon's pid file lives. Honors
 * `TOGETHERLINK_HOME` (matching autoupdate.ts/install.sh's install dir) so a
 * user with a custom install home keeps the pid file alongside the bundle.
 */
export function daemonPidPath(home = togetherlinkHome()): string {
  return path.join(home, "daemon.pid");
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
  /**
   * Injected session registry — defaults to the process-wide singleton. Tests
   * pass a fresh registry to exercise the lifecycle in isolation rather than
   * booting a real daemon process (#5: the interface is the test surface).
   */
  sessions?: SessionRegistry;
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
            process.exit(healthyPortRaceExitCode());
          }
          process.stderr.write(
            `[togetherlink daemon] port ${port} in use by a non-daemon process.\n`,
          );
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
 * A detached concurrent spawn may yield to an existing healthy daemon and
 * finish successfully. A launchd/systemd-owned daemon must instead fail so
 * its supervisor retries and eventually takes the port when the legacy owner
 * disappears.
 */
export function healthyPortRaceExitCode(): 0 | 1 {
  return process.env.TOGETHERLINK_SUPERVISED === "1" ? 1 : 0;
}

/**
 * Render an error from the daemon's top-level catch-all in the wire format the
 * requesting client actually speaks. Anthropic errors get the Anthropic shape;
 * Codex (Responses API) errors get the OpenAI shape; unknown agents default to
 * Anthropic (the original behavior) so we never regress the Claude path.
 *
 * This closes the cross-seam leak where Codex errors were always rendered as
 * Anthropic errors because the catch-all imported `isTogetherApiError` +
 * `writeAnthropicError` only from the Claude tree (see codex/proxy.ts for the
 * Codex-owned `writeOpenAIError`, which the old path never reached).
 */
export function renderDaemonError(
  res: ServerResponse,
  err: unknown,
  agent: string | undefined,
): void {
  if (res.headersSent) {
    // A streaming response (Codex SSE, native passthrough) already sent
    // headers before this error hit; the client has a partial response on
    // this connection, so a fresh error body can't be written on top of it.
    // Writing one anyway throws ERR_HTTP_HEADERS_SENT, which — uncaught here —
    // used to crash the whole daemon process for every active session.
    if (!res.writableEnded) {
      res.end();
    }
    return;
  }
  if (agent === "codex" || agent === "codex-app") {
    if (err instanceof CodexTogetherError) {
      writeOpenAIError(res, err.status, err.type, err.message, err.code);
      return;
    }
    if (err instanceof CodexRequestError) {
      writeOpenAIError(
        res,
        err.status,
        err.status === 413 ? "request_too_large" : "invalid_request_error",
        err.message,
      );
      return;
    }
    if (err instanceof TogetherResponseHeaderTimeoutError) {
      writeOpenAIError(res, 504, "timeout_error", err.message);
      return;
    }
    if (isTogetherApiError(err)) {
      writeOpenAIError(res, err.anthropicStatus, err.anthropicType, err.message);
      return;
    }
    writeOpenAIError(res, 500, "api_error", err instanceof Error ? err.message : String(err));
    return;
  }
  if (err instanceof TogetherResponseHeaderTimeoutError) {
    writeAnthropicError(res, 504, "timeout_error", err.message);
    return;
  }
  if (isTogetherApiError(err)) {
    writeAnthropicError(res, err.anthropicStatus, err.anthropicType, err.message);
    return;
  }
  writeAnthropicError(res, 500, "api_error", err instanceof Error ? err.message : String(err));
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
  activeSessions = options.sessions ?? defaultSessions;
  const restored = await activeSessions.restorePersisted();

  const server = http.createServer((req, res) => {
    // This context must be request-local: concurrent Claude and Codex requests
    // can fail in either order and still need their own wire-format error.
    let requestAgent: string | undefined;
    handleDaemonRequest(req, res, {
      debug,
      setAgent: (a) => {
        requestAgent = a;
      },
    }).catch((err: unknown) => {
      if (debug) {
        process.stderr.write(
          `[togetherlink daemon] request error (${requestAgent ?? "unknown"}): ${
            err instanceof Error ? (err.stack ?? err.message) : String(err)
          }\n`,
        );
      }
      try {
        renderDaemonError(res, err, requestAgent);
      } catch {
        // A response-write failure here must never take the daemon down —
        // it's shared across every active session, not just this request.
        if (!res.writableEnded) {
          res.destroy();
        }
      }
    });
  });
  // Codex/ChatGPT Desktop's Responses-over-WebSocket transport is only
  // supported for the codex/codex-app `/v1/responses` route, which is the
  // only place we can usefully terminate it (Together has no upstream WS to
  // relay to — see codex/responses-websocket.ts). Everything else (other
  // paths, other agents, unresolved sessions) gets the same immediate 426
  // rejection as before instead of hanging as a long-lived ordinary GET.
  server.on("upgrade", (req, socket, head) => {
    handleDaemonUpgrade(req, socket, head).catch(() => {
      socket.destroy();
    });
  });
  // Node's default requestTimeout (5 min) kills the socket outright once a
  // client is slow sending a large request body — e.g. a Codex turn with a
  // multi-million-token cached context. Our own upstream timeouts (Together
  // response-header/stream timeouts, native passthrough's client-abort) are
  // the real deadlines; the server shouldn't impose a second, shorter one.
  server.requestTimeout = 0;
  server.headersTimeout = 65_000;

  await listenOrExitOnRace(server, port);

  await mkdir(path.dirname(daemonPidPath()), { recursive: true });
  await writeFile(daemonPidPath(), `${process.pid}\n`, { encoding: "utf8" });
  if (process.env.TOGETHERLINK_SUPERVISED === "1") {
    process.stderr.write(
      `[togetherlink daemon] supervised daemon started on ${daemonUrl(port)} (pid ${process.pid}).\n`,
    );
  }
  if (debug) {
    process.stderr.write(
      `[togetherlink daemon] listening: ${daemonUrl(port)} (pid ${process.pid})\n`,
    );
    if (restored > 0) {
      process.stderr.write(`[togetherlink daemon] restored ${restored} active session(s).\n`);
    }
  }

  let closing = false;
  // Periodically reap sessions whose launcher (claude child) has died without
  // deregistering — e.g. the launcher was kill -9'd. Keeps the registry from
  // growing without bound over the daemon's lifetime.
  const reaper = setInterval(() => {
    const removed = activeSessions.reapDead();
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
    if (process.env.TOGETHERLINK_SUPERVISED === "1") {
      process.stderr.write(
        `[togetherlink daemon] received ${signal}; shutting down cleanly for supervisor restart.\n`,
      );
    }
    clearInterval(reaper);
    if (debug) {
      process.stderr.write(`[togetherlink daemon] ${signal} — shutting down.\n`);
    }
    // Stop accepting new work, but keep the process alive until every request
    // that already has a socket finishes. Exiting immediately here severs all
    // active Codex/Claude streams during a launchd/systemd service refresh and
    // makes the client report a low-level localhost transport failure.
    server.keepAliveTimeout = 1;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(forceClose);
        resolve();
      };
      const forceClose = setTimeout(() => {
        if (debug) {
          process.stderr.write(
            "[togetherlink daemon] shutdown grace period expired; closing active connections.\n",
          );
        }
        server.closeAllConnections();
        finish();
      }, daemonShutdownGraceMs());
      forceClose.unref();
      server.close(finish);
      // Do not let idle keep-alive sockets consume launchd's exit window.
      // Active requests are deliberately left alone and keep draining.
      server.closeIdleConnections();
    });
    activeSessions.closeStore();
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

function daemonShutdownGraceMs(): number {
  const configured = Number.parseInt(process.env.TOGETHERLINK_SHUTDOWN_GRACE_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 10_000;
}

type DaemonRequestOptions = {
  debug: boolean;
  /** Receives the resolved session agent so the catch-all can render errors in
   * the matching wire format (Anthropic vs OpenAI Responses). */
  setAgent?: (agent: string | undefined) => void;
};

async function handleDaemonRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: DaemonRequestOptions,
): Promise<void> {
  const path_ = requestPath(req);
  if (opts.debug) {
    const loggedPath = path_.replace(/^\/session\/[^/]+(?=\/|$)/, "/session/[REDACTED]");
    process.stderr.write(`[togetherlink daemon] ${req.method} ${loggedPath}\n`);
  }

  // Unauthenticated liveness + health (must work before any session exists).
  if (req.method === "HEAD" && path_ === "/") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method === "GET" && path_ === "/healthz") {
    writeJson(res, 200, {
      ok: true,
      pid: process.pid,
      version: VERSION,
      home: togetherlinkHome(),
      scriptPath: RUNNING_DAEMON_IDENTITY.scriptPath,
      scriptSize: RUNNING_DAEMON_IDENTITY.scriptSize,
      scriptMtimeMs: RUNNING_DAEMON_IDENTITY.scriptMtimeMs,
      activeSessionCount: activeSessions.size,
    } satisfies DaemonHealth);
    return;
  }

  if (req.method === "GET" && path_ === "/") {
    writeJson(res, 200, {
      ok: true,
      service: "togetherlink daemon",
      version: VERSION,
      activeSessionCount: activeSessions.size,
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
      // victim's token and impersonate their session. Local callers only need
      // the count + agent/modelLabel/started; per-session detail
      // (cost/delete/usage) is keyed by a token only the owning launcher knows.
      writeJson(res, 200, {
        count: activeSessions.size,
        sessions: activeSessions.list().map(toPublicSessionView),
      });
      return;
    }
    writeAnthropicError(res, 405, "method_not_allowed", `Unsupported method ${req.method ?? ""}`);
    return;
  }

  const costMatch = path_.match(COST_ROUTE);
  if (costMatch && req.method === "GET") {
    const state = activeSessions.get(decodeURIComponent(costMatch[1] as string));
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    writeJson(res, 200, {
      summary: state.costTracker.summarize(),
      totals: state.costTracker.totals,
      totalsByModel: state.costTracker.totalsByModel,
      ...(state.proxyPerf !== undefined ? { proxyPerf: state.proxyPerf } : {}),
    });
    return;
  }

  const usageMatch = path_.match(USAGE_ROUTE);
  if (usageMatch && req.method === "POST") {
    const state = activeSessions.get(decodeURIComponent(usageMatch[1] as string));
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
    // session's tracker so the cost endpoint shows it uniformly.
    if (promptTokens > 0 || completionTokens > 0) {
      state.costTracker.addUsage(
        promptTokens,
        cachedTokens,
        completionTokens,
        state.modelDefinition,
      );
    }
    if (typeof body?.summary === "string" && body.summary) {
      state.costTracker.setExternalSummary(body.summary);
    }
    activeSessions.updateUsage(
      state.token,
      typeof body?.summary === "string" && body.summary ? body.summary : undefined,
    );
    writeJson(res, 200, { ok: true });
    return;
  }

  const pidMatch = path_.match(PID_ROUTE);
  if (pidMatch && req.method === "POST") {
    const token = decodeURIComponent(pidMatch[1] as string);
    const state = activeSessions.get(token);
    if (!state) {
      writeAnthropicError(res, 404, "not_found_error", "Unknown session token.");
      return;
    }
    const body = (await readJsonBody(req)) as { pid?: number };
    if (typeof body?.pid === "number") {
      activeSessions.updatePid(token, body.pid);
    }
    writeJson(res, 200, { ok: true });
    return;
  }

  const deleteMatch = path_.match(SESSION_ROUTE);
  if (deleteMatch && req.method === "DELETE") {
    const removed = activeSessions.delete(decodeURIComponent(deleteMatch[1] as string));
    writeJson(res, removed ? 200 : 404, removed ? { ok: true } : { ok: false });
    return;
  }

  // Everything below is a proxied-agent-facing request that must belong to a
  // session. Self-reporting agents (OpenCode) never send traffic here — they go
  // direct to Together — so a request carrying their token is a
  // misconfiguration; refuse it clearly.
  const sessionRoute = localSessionRoute(req, path_);
  const token = sessionRoute?.token ?? extractToken(req);
  let session = token !== undefined ? activeSessions.get(token) : undefined;
  if (session === undefined && token !== undefined) {
    session = await restoreAppSession(token);
  }
  if (!session) {
    writeAnthropicError(res, 401, "authentication_error", "Unauthorized local proxy request.");
    return;
  }
  // Surface the agent to the catch-all BEFORE dispatch, so a throw from either
  // proxy handler is rendered in the client's own wire format.
  opts.setAgent?.(session.agent);
  if (!isProxiedAgent(session.agent) || session.options === undefined) {
    writeAnthropicError(
      res,
      404,
      "not_found_error",
      `This session's agent (${session.agent}) is not proxied by the daemon.`,
    );
    return;
  }

  // The secret session-URL path token already authenticated this request, but
  // the proxy handlers re-check the Authorization header against the session's
  // authToken. Claude Code 2.1.197+ overrides ANTHROPIC_AUTH_TOKEN with the
  // user's claude.ai OAuth token when they are logged in, so rewrite the header
  // to the expected token (this also keeps the OAuth credential out of any
  // downstream logging).
  const preserveNativeCodexAuth =
    session.agent === "codex-app" &&
    (session.options as CodexProxyOptions).nativeBaseUrl !== undefined;
  if (sessionRoute !== undefined && !preserveNativeCodexAuth) {
    req.headers.authorization = `Bearer ${session.options.authToken}`;
    delete req.headers["x-api-key"];
  }

  if (session.agent === "codex" || session.agent === "codex-app") {
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

/**
 * Re-register the persistent codex-app session from its on-disk registration.
 * The Codex desktop app holds the stable local-proxy token in its config with
 * no launcher process alive to re-register when this daemon loses the session
 * (restart, idle reap, kill -9). Without this fallback every request from the
 * app 401s until the user re-runs `togetherlink codex-app`.
 */
async function restoreAppSession(token: string): Promise<SessionState | undefined> {
  const registration = await readAppRegistration();
  if (registration === undefined || registration.token !== token) {
    return undefined;
  }
  const state = buildSession(registration);
  activeSessions.register(state);
  return state;
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

const REJECT_UPGRADE =
  "HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\nContent-Length: 0\r\n\r\n";

async function handleDaemonUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  const path_ = requestPath(req);
  const sessionRoute = localSessionRoute(req, path_);
  // localSessionRoute rewrites req.url to the inner path in place when it
  // matches, so re-reading it now gives the path with /session/<token>
  // stripped — same trick handleDaemonRequest's downstream handlers rely on.
  const innerPath = sessionRoute ? requestPath(req) : undefined;
  if (!innerPath || !isCodexResponsesWebsocketPath(innerPath)) {
    socket.on("error", () => {});
    socket.end(REJECT_UPGRADE);
    return;
  }

  const token = sessionRoute!.token;
  const session = activeSessions.get(token) ?? (await restoreAppSession(token));
  if (
    !session ||
    (session.agent !== "codex" && session.agent !== "codex-app") ||
    session.options === undefined
  ) {
    socket.on("error", () => {});
    socket.end(REJECT_UPGRADE);
    return;
  }

  const options = session.options as CodexProxyOptions;
  responsesWebsocketServer.handleUpgrade(req, socket, head, (ws) => {
    // Forward the upgrade's headers so the native WS<->WS relay can reuse the
    // client's auth/session headers on its upstream dial (the HTTP path gets
    // these from the request itself; WS turns have no per-message headers).
    handleCodexResponsesWebsocket(ws, options, req.headers);
  });
}

async function registerSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as RegisterSessionRequest;
  // Agent-neutral core: every session needs a non-empty token + apiKey, a
  // modelDefinition (for CostTracker pricing), and a display modelLabel.
  const coreMissing =
    !body ||
    typeof body.token !== "string" ||
    !body.token ||
    typeof body.apiKey !== "string" ||
    !body.apiKey ||
    typeof body.modelLabel !== "string" ||
    !body.modelLabel ||
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
      typeof body.modelId !== "string" ||
      !body.modelId ||
      typeof body.targetModelId !== "string" ||
      !body.targetModelId;
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
  activeSessions.register(state);
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
 * Best-effort health probe. Exported so the launcher (`launch.ts`) can reuse
 * it. Resolves false on any failure (refused, timeout, non-200) rather than
 * rejecting.
 */
export async function probeHealthz(port: number): Promise<boolean> {
  return (await probeDaemonHealth(port)) !== undefined;
}

export async function probeDaemonHealth(port: number): Promise<DaemonHealth | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300);
    const response = await fetch(`${daemonUrl(port)}/healthz`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json().catch(() => undefined)) as
      | Partial<DaemonHealth>
      | undefined;
    if (body?.ok !== true) {
      return undefined;
    }
    return {
      ok: true,
      pid: typeof body.pid === "number" ? body.pid : 0,
      version: typeof body.version === "string" ? body.version : "",
      home: typeof body.home === "string" ? body.home : null,
      scriptPath: typeof body.scriptPath === "string" ? body.scriptPath : null,
      scriptSize: typeof body.scriptSize === "number" ? body.scriptSize : null,
      scriptMtimeMs: typeof body.scriptMtimeMs === "number" ? body.scriptMtimeMs : null,
      activeSessionCount:
        typeof body.activeSessionCount === "number" ? body.activeSessionCount : -1,
    };
  } catch {
    return undefined;
  }
}

function daemonIdentityAtStartup(): Pick<
  DaemonHealth,
  "scriptPath" | "scriptSize" | "scriptMtimeMs"
> {
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  if (!scriptPath) {
    return { scriptPath: null, scriptSize: null, scriptMtimeMs: null };
  }
  try {
    const stat = statSync(scriptPath);
    return { scriptPath, scriptSize: stat.size, scriptMtimeMs: stat.mtimeMs };
  } catch {
    return { scriptPath, scriptSize: null, scriptMtimeMs: null };
  }
}
