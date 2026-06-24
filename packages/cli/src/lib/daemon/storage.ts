import type { TokenUsage } from "../claude/cost.js";
import type { ProxyTraceEvent } from "../proxy-trace.js";
import type { AgentId, RegisterSessionRequest, SessionPublicView } from "./state.js";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DATABASE_FILE = "daemon.sqlite";
const LEGACY_SESSION_STORE_FILE = "daemon-sessions.json";
const MAX_RECENT_SESSIONS = 50;
const MAX_TRACES_PER_SESSION = 200;

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close?: () => void;
};

export type StoredSession = RegisterSessionRequest & {
  startedAt: number;
  endedAt?: number;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  externalSummary?: string;
  traces?: ProxyTraceEvent[];
};

export type SessionPersistInput = RegisterSessionRequest & {
  startedAt: number;
  endedAt?: number;
  costSummary: string;
  costTotals: TokenUsage;
  externalSummary?: string;
};

export type DashboardSnapshot = {
  generatedAt: number;
  totals: {
    active: number;
    recent: number;
    all: number;
    traces: number;
  };
  sessions: SessionPublicView[];
};

export type DashboardStore = {
  kind: "sqlite" | "json";
  restoreActiveSessions(): StoredSession[];
  upsertSession(session: SessionPersistInput): void;
  markSessionEnded(token: string, endedAt: number, costSummary: string, costTotals: TokenUsage): void;
  updateSessionPid(token: string, pid: number): void;
  updateSessionUsage(token: string, costSummary: string, costTotals: TokenUsage, externalSummary?: string): void;
  upsertTrace(token: string, trace: ProxyTraceEvent): void;
  recentSessions(excludingTokens: Set<string>, limit?: number): SessionPublicView[];
  close(): void;
};

export async function createDashboardStore(home = resolveTogetherlinkHome()): Promise<DashboardStore> {
  await mkdir(home, { recursive: true });
  const sqlite = await openSqlite(path.join(home, DATABASE_FILE));
  if (sqlite) {
    await chmod(path.join(home, DATABASE_FILE), 0o600).catch(() => {});
    return new SqliteDashboardStore(sqlite);
  }
  return new JsonDashboardStore(path.join(home, LEGACY_SESSION_STORE_FILE));
}

export function resolveDashboardDatabasePath(home = resolveTogetherlinkHome()): string {
  return path.join(home, DATABASE_FILE);
}

function resolveTogetherlinkHome(): string {
  return process.env.TOGETHERLINK_HOME || path.join(os.homedir(), ".togetherlink");
}

async function openSqlite(file: string): Promise<SqliteDatabase | undefined> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const preferBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  const attempts = preferBun ? ["bun:sqlite", "node:sqlite"] : ["node:sqlite", "bun:sqlite"];
  for (const specifier of attempts) {
    try {
      const mod = (await dynamicImport(specifier)) as Record<string, unknown>;
      if (specifier === "bun:sqlite" && typeof mod.Database === "function") {
        return new BunSqliteDatabase(new (mod.Database as new (path: string) => unknown)(file));
      }
      if (specifier === "node:sqlite" && typeof mod.DatabaseSync === "function") {
        return new NodeSqliteDatabase(new (mod.DatabaseSync as new (path: string) => unknown)(file));
      }
    } catch {
      // Try the next runtime. Older Node and some bundled runtimes do not expose
      // a SQLite module, but the daemon can still run with the JSON fallback.
    }
  }
  return undefined;
}

class BunSqliteDatabase implements SqliteDatabase {
  constructor(private readonly db: unknown) {}

  exec(sql: string): void {
    (this.db as { exec: (sql: string) => void }).exec(sql);
  }

  prepare(sql: string): ReturnType<SqliteDatabase["prepare"]> {
    const statement = (this.db as { query: (sql: string) => unknown }).query(sql);
    return {
      run: (...params) => (statement as { run: (...params: unknown[]) => unknown }).run(...params),
      get: (...params) => (statement as { get: (...params: unknown[]) => unknown }).get(...params),
      all: (...params) => (statement as { all: (...params: unknown[]) => unknown[] }).all(...params),
    };
  }

  close(): void {
    (this.db as { close?: () => void }).close?.();
  }
}

class NodeSqliteDatabase implements SqliteDatabase {
  constructor(private readonly db: unknown) {}

  exec(sql: string): void {
    (this.db as { exec: (sql: string) => void }).exec(sql);
  }

  prepare(sql: string): ReturnType<SqliteDatabase["prepare"]> {
    const statement = (this.db as { prepare: (sql: string) => unknown }).prepare(sql);
    return {
      run: (...params) => (statement as { run: (...params: unknown[]) => unknown }).run(...params),
      get: (...params) => (statement as { get: (...params: unknown[]) => unknown }).get(...params),
      all: (...params) => (statement as { all: (...params: unknown[]) => unknown[] }).all(...params),
    };
  }

  close(): void {
    (this.db as { close?: () => void }).close?.();
  }
}

class SqliteDashboardStore implements DashboardStore {
  readonly kind = "sqlite";

  constructor(private readonly db: SqliteDatabase) {
    this.migrate();
  }

  restoreActiveSessions(): StoredSession[] {
    const rows = this.db
      .prepare("SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at ASC")
      .all() as SessionRow[];
    return rows.map((row) => this.toStoredSession(row));
  }

  upsertSession(session: SessionPersistInput): void {
    this.db
      .prepare(`
        INSERT INTO sessions (
          token, agent, pid, started_at, ended_at, model_label, api_key, auth_token,
          model_id, target_model_id, model_name, model_definition_json, debug,
          prompt_tokens, cached_tokens, completion_tokens, cost_usd, cost_summary,
          external_summary, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          agent = excluded.agent,
          pid = excluded.pid,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          model_label = excluded.model_label,
          api_key = excluded.api_key,
          auth_token = excluded.auth_token,
          model_id = excluded.model_id,
          target_model_id = excluded.target_model_id,
          model_name = excluded.model_name,
          model_definition_json = excluded.model_definition_json,
          debug = excluded.debug,
          prompt_tokens = excluded.prompt_tokens,
          cached_tokens = excluded.cached_tokens,
          completion_tokens = excluded.completion_tokens,
          cost_usd = excluded.cost_usd,
          cost_summary = excluded.cost_summary,
          external_summary = excluded.external_summary,
          updated_at = excluded.updated_at
      `)
      .run(...sessionParams(session, Date.now()));
  }

  markSessionEnded(token: string, endedAt: number, costSummary: string, costTotals: TokenUsage): void {
    this.db
      .prepare(`
        UPDATE sessions
        SET ended_at = ?, prompt_tokens = ?, cached_tokens = ?, completion_tokens = ?,
            cost_usd = ?, cost_summary = ?, updated_at = ?
        WHERE token = ?
      `)
      .run(
        endedAt,
        costTotals.promptTokens,
        costTotals.cachedTokens,
        costTotals.completionTokens,
        costTotals.costUsd,
        costSummary,
        Date.now(),
        token,
      );
  }

  updateSessionPid(token: string, pid: number): void {
    this.db.prepare("UPDATE sessions SET pid = ?, updated_at = ? WHERE token = ?").run(pid, Date.now(), token);
  }

  updateSessionUsage(token: string, costSummary: string, costTotals: TokenUsage, externalSummary?: string): void {
    this.db
      .prepare(`
        UPDATE sessions
        SET prompt_tokens = ?, cached_tokens = ?, completion_tokens = ?, cost_usd = ?,
            cost_summary = ?, external_summary = COALESCE(?, external_summary), updated_at = ?
        WHERE token = ?
      `)
      .run(
        costTotals.promptTokens,
        costTotals.cachedTokens,
        costTotals.completionTokens,
        costTotals.costUsd,
        costSummary,
        externalSummary ?? null,
        Date.now(),
        token,
      );
  }

  upsertTrace(token: string, trace: ProxyTraceEvent): void {
    this.db
      .prepare(`
        INSERT INTO traces (
          id, session_token, route, method, model, stream, request_bytes,
          request_preview, cache_key_json, prompt_profile_json, message_count,
          tool_count, native_tool_count, started_at, upstream_started_at,
          upstream_headers_at, first_byte_at, duration_ms, completed_at, ok,
          status, error, usage_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          session_token = excluded.session_token,
          route = excluded.route,
          method = excluded.method,
          model = excluded.model,
          stream = excluded.stream,
          request_bytes = excluded.request_bytes,
          request_preview = excluded.request_preview,
          cache_key_json = excluded.cache_key_json,
          prompt_profile_json = excluded.prompt_profile_json,
          message_count = excluded.message_count,
          tool_count = excluded.tool_count,
          native_tool_count = excluded.native_tool_count,
          started_at = excluded.started_at,
          upstream_started_at = excluded.upstream_started_at,
          upstream_headers_at = excluded.upstream_headers_at,
          first_byte_at = excluded.first_byte_at,
          duration_ms = excluded.duration_ms,
          completed_at = excluded.completed_at,
          ok = excluded.ok,
          status = excluded.status,
          error = excluded.error,
          usage_json = excluded.usage_json,
          updated_at = excluded.updated_at
      `)
      .run(...traceParams(token, trace, Date.now()));
    this.trimSessionTraces(token);
  }

  recentSessions(excludingTokens: Set<string>, limit = MAX_RECENT_SESSIONS): SessionPublicView[] {
    const rows = this.db
      .prepare(
        `
          SELECT * FROM sessions
          WHERE ended_at IS NOT NULL
          ORDER BY ended_at DESC
          LIMIT ?
        `,
      )
      .all(limit * 2) as SessionRow[];
    return rows
      .filter((row) => !excludingTokens.has(row.token))
      .slice(0, limit)
      .map((row) => this.toPublicSession(row));
  }

  close(): void {
    this.db.close?.();
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pid INTEGER,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        model_label TEXT NOT NULL,
        api_key TEXT NOT NULL,
        auth_token TEXT,
        model_id TEXT,
        target_model_id TEXT,
        model_name TEXT,
        model_definition_json TEXT NOT NULL,
        debug INTEGER,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        cost_summary TEXT NOT NULL DEFAULT '',
        external_summary TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        session_token TEXT NOT NULL REFERENCES sessions(token) ON DELETE CASCADE,
        route TEXT NOT NULL,
        method TEXT NOT NULL,
        model TEXT,
        stream INTEGER,
        request_bytes INTEGER,
        request_preview TEXT,
        cache_key_json TEXT,
        prompt_profile_json TEXT,
        message_count INTEGER,
        tool_count INTEGER,
        native_tool_count INTEGER,
        started_at INTEGER NOT NULL,
        upstream_started_at INTEGER,
        upstream_headers_at INTEGER,
        first_byte_at INTEGER,
        duration_ms INTEGER,
        completed_at INTEGER,
        ok INTEGER,
        status INTEGER,
        error TEXT,
        usage_json TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at DESC);
      CREATE INDEX IF NOT EXISTS idx_traces_session_started ON traces(session_token, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_traces_started_at ON traces(started_at DESC);
    `);
  }

  private toStoredSession(row: SessionRow): StoredSession {
    const session = rowToSessionBase(row);
    return {
      ...session,
      promptTokens: row.prompt_tokens,
      cachedTokens: row.cached_tokens,
      completionTokens: row.completion_tokens,
      costUsd: row.cost_usd,
      ...(row.external_summary ? { externalSummary: row.external_summary } : {}),
      traces: this.tracesFor(row.token),
    };
  }

  private toPublicSession(row: SessionRow): SessionPublicView {
    return {
      agent: row.agent as AgentId,
      modelLabel: row.model_label,
      ...(typeof row.pid === "number" ? { pid: row.pid } : {}),
      startedAt: row.started_at,
      ...(typeof row.ended_at === "number" ? { endedAt: row.ended_at } : {}),
      status: row.ended_at === null || row.ended_at === undefined ? "running" : "ended",
      costSummary: row.cost_summary || formatCostSummary(row),
      traceCount: this.traceCount(row.token),
      traces: this.tracesFor(row.token),
    };
  }

  private tracesFor(token: string): ProxyTraceEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM traces WHERE session_token = ? ORDER BY started_at DESC LIMIT ?")
      .all(token, MAX_TRACES_PER_SESSION) as TraceRow[];
    return rows.map(rowToTrace);
  }

  private traceCount(token: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM traces WHERE session_token = ?").get(token) as
      | { count?: number }
      | undefined;
    return row?.count ?? 0;
  }

  private trimSessionTraces(token: string): void {
    this.db
      .prepare(
        `
          DELETE FROM traces
          WHERE session_token = ?
            AND id NOT IN (
              SELECT id FROM traces
              WHERE session_token = ?
              ORDER BY started_at DESC
              LIMIT ?
            )
        `,
      )
      .run(token, token, MAX_TRACES_PER_SESSION);
  }
}

class JsonDashboardStore implements DashboardStore {
  readonly kind = "json";

  constructor(private readonly file: string) {}

  restoreActiveSessions(): StoredSession[] {
    return [];
  }

  upsertSession(session: SessionPersistInput): void {
    void this.writeActive([session]);
  }

  markSessionEnded(): void {}

  updateSessionPid(): void {}

  updateSessionUsage(): void {}

  upsertTrace(): void {}

  recentSessions(): SessionPublicView[] {
    return [];
  }

  close(): void {}

  private async writeActive(active: SessionPersistInput[]): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, `${JSON.stringify(active, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, this.file);
  }
}

export async function readLegacyActiveSessions(home = resolveTogetherlinkHome()): Promise<StoredSession[]> {
  try {
    const value = JSON.parse(await readFile(path.join(home, LEGACY_SESSION_STORE_FILE), "utf8")) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(isStoredSession);
  } catch {
    return [];
  }
}

function sessionParams(session: SessionPersistInput, updatedAt: number): unknown[] {
  return [
    session.token,
    session.agent ?? "claude",
    session.pid ?? null,
    session.startedAt,
    session.endedAt ?? null,
    session.modelLabel,
    session.apiKey,
    session.authToken ?? null,
    session.modelId ?? null,
    session.targetModelId ?? null,
    session.modelName ?? null,
    JSON.stringify(session.modelDefinition),
    session.debug === undefined ? null : session.debug ? 1 : 0,
    session.costTotals.promptTokens,
    session.costTotals.cachedTokens,
    session.costTotals.completionTokens,
    session.costTotals.costUsd,
    session.costSummary,
    session.externalSummary ?? null,
    updatedAt,
  ];
}

function traceParams(token: string, trace: ProxyTraceEvent, updatedAt: number): unknown[] {
  return [
    trace.id,
    token,
    trace.route,
    trace.method,
    trace.model ?? null,
    trace.stream === undefined ? null : trace.stream ? 1 : 0,
    trace.requestBytes ?? null,
    trace.requestPreview ?? null,
    trace.cacheKey ? JSON.stringify(trace.cacheKey) : null,
    trace.promptProfile ? JSON.stringify(trace.promptProfile) : null,
    trace.messageCount ?? null,
    trace.toolCount ?? null,
    trace.nativeToolCount ?? null,
    trace.startedAt,
    trace.upstreamStartedAt ?? null,
    trace.upstreamHeadersAt ?? null,
    trace.firstByteAt ?? null,
    trace.durationMs ?? null,
    trace.completedAt ?? null,
    trace.ok === undefined ? null : trace.ok ? 1 : 0,
    trace.status ?? null,
    trace.error ?? null,
    trace.usage ? JSON.stringify(trace.usage) : null,
    updatedAt,
  ];
}

type SessionRow = {
  token: string;
  agent: string;
  pid: number | null;
  started_at: number;
  ended_at: number | null;
  model_label: string;
  api_key: string;
  auth_token: string | null;
  model_id: string | null;
  target_model_id: string | null;
  model_name: string | null;
  model_definition_json: string;
  debug: number | null;
  prompt_tokens: number;
  cached_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  cost_summary: string;
  external_summary: string | null;
};

type TraceRow = {
  id: string;
  route: string;
  method: string;
  model: string | null;
  stream: number | null;
  request_bytes: number | null;
  request_preview: string | null;
  cache_key_json: string | null;
  prompt_profile_json: string | null;
  message_count: number | null;
  tool_count: number | null;
  native_tool_count: number | null;
  started_at: number;
  upstream_started_at: number | null;
  upstream_headers_at: number | null;
  first_byte_at: number | null;
  duration_ms: number | null;
  completed_at: number | null;
  ok: number | null;
  status: number | null;
  error: string | null;
  usage_json: string | null;
};

function rowToSessionBase(row: SessionRow): StoredSession {
  return {
    token: row.token,
    agent: row.agent as AgentId,
    ...(typeof row.pid === "number" ? { pid: row.pid } : {}),
    apiKey: row.api_key,
    ...(row.auth_token ? { authToken: row.auth_token } : {}),
    modelLabel: row.model_label,
    modelDefinition: parseJson(row.model_definition_json, {}) as StoredSession["modelDefinition"],
    ...(row.model_id ? { modelId: row.model_id } : {}),
    ...(row.target_model_id ? { targetModelId: row.target_model_id } : {}),
    ...(row.model_name ? { modelName: row.model_name } : {}),
    ...(row.debug !== null ? { debug: row.debug === 1 } : {}),
    startedAt: row.started_at,
    ...(typeof row.ended_at === "number" ? { endedAt: row.ended_at } : {}),
  };
}

function rowToTrace(row: TraceRow): ProxyTraceEvent {
  const trace: ProxyTraceEvent = {
    id: row.id,
    route: row.route,
    method: row.method,
    ...(row.model ? { model: row.model } : {}),
    ...(row.stream !== null ? { stream: row.stream === 1 } : {}),
    ...(typeof row.request_bytes === "number" ? { requestBytes: row.request_bytes } : {}),
    ...(row.request_preview ? { requestPreview: row.request_preview } : {}),
    ...(typeof row.message_count === "number" ? { messageCount: row.message_count } : {}),
    ...(typeof row.tool_count === "number" ? { toolCount: row.tool_count } : {}),
    ...(typeof row.native_tool_count === "number" ? { nativeToolCount: row.native_tool_count } : {}),
    startedAt: row.started_at,
    ...(typeof row.upstream_started_at === "number" ? { upstreamStartedAt: row.upstream_started_at } : {}),
    ...(typeof row.upstream_headers_at === "number" ? { upstreamHeadersAt: row.upstream_headers_at } : {}),
    ...(typeof row.first_byte_at === "number" ? { firstByteAt: row.first_byte_at } : {}),
    ...(typeof row.duration_ms === "number" ? { durationMs: row.duration_ms } : {}),
    ...(typeof row.completed_at === "number" ? { completedAt: row.completed_at } : {}),
    ...(row.ok !== null ? { ok: row.ok === 1 } : {}),
    ...(typeof row.status === "number" ? { status: row.status } : {}),
    ...(row.error ? { error: row.error } : {}),
  };
  if (row.cache_key_json) {
    const cacheKey = parseJson(row.cache_key_json, undefined) as ProxyTraceEvent["cacheKey"];
    if (cacheKey) {
      trace.cacheKey = cacheKey;
    }
  }
  if (row.prompt_profile_json) {
    const promptProfile = parseJson(row.prompt_profile_json, undefined) as ProxyTraceEvent["promptProfile"];
    if (promptProfile) {
      trace.promptProfile = promptProfile;
    }
  }
  if (row.usage_json) {
    const usage = parseJson(row.usage_json, undefined) as ProxyTraceEvent["usage"];
    if (usage) {
      trace.usage = usage;
    }
  }
  return trace;
}

function formatCostSummary(row: SessionRow): string {
  return (
    `[togetherlink cost] session total: $${row.cost_usd.toFixed(4)} ` +
    `(${row.prompt_tokens.toLocaleString("en-US")} in` +
    (row.cached_tokens > 0 ? ` incl ${row.cached_tokens.toLocaleString("en-US")} cached` : "") +
    `, ${row.completion_tokens.toLocaleString("en-US")} out)`
  );
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  const session = value as StoredSession;
  return (
    typeof session?.token === "string" &&
    session.token.length > 0 &&
    typeof session.apiKey === "string" &&
    session.apiKey.length > 0 &&
    typeof session.modelLabel === "string" &&
    typeof session.startedAt === "number" &&
    typeof session.modelDefinition === "object" &&
    session.modelDefinition !== null
  );
}
