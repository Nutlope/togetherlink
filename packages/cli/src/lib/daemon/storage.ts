import type { TokenUsage } from "../cost.js";
import type { AgentId, RegisterSessionRequest } from "./state.js";
import { chmod, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { togetherlinkHome } from "../paths.js";

const DATABASE_FILE = "daemon.sqlite";

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
  lastSeenAt?: number;
  endedAt?: number;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  externalSummary?: string;
};

export type SessionPersistInput = RegisterSessionRequest & {
  startedAt: number;
  lastSeenAt: number;
  endedAt?: number;
  costSummary: string;
  costTotals: TokenUsage;
  externalSummary?: string;
};

export type SessionStore = {
  kind: "sqlite" | "memory";
  restoreActiveSessions(): StoredSession[];
  upsertSession(session: SessionPersistInput): void;
  markSessionEnded(
    token: string,
    endedAt: number,
    costSummary: string,
    costTotals: TokenUsage,
  ): void;
  updateSessionPid(token: string, pid: number): void;
  updateSessionUsage(
    token: string,
    costSummary: string,
    costTotals: TokenUsage,
    externalSummary?: string,
  ): void;
  updateSessionLastSeen(token: string, lastSeenAt: number): void;
  close(): void;
};

export async function createSessionStore(home = togetherlinkHome()): Promise<SessionStore> {
  await mkdir(home, { recursive: true });
  const sqlite = await openSqlite(path.join(home, DATABASE_FILE));
  if (sqlite) {
    await chmod(path.join(home, DATABASE_FILE), 0o600).catch(() => {});
    try {
      return new ResilientSessionStore(new SqliteSessionStore(sqlite));
    } catch (err) {
      sqlite.close?.();
      warnStoreError("initialize sqlite session store", err);
    }
  }
  return new ResilientSessionStore(new MemorySessionStore());
}

export function resolveSessionDatabasePath(home = togetherlinkHome()): string {
  return path.join(home, DATABASE_FILE);
}

async function openSqlite(file: string): Promise<SqliteDatabase | undefined> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  const preferBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  const attempts = preferBun ? ["bun:sqlite", "node:sqlite"] : ["node:sqlite", "bun:sqlite"];
  for (const specifier of attempts) {
    try {
      const mod = (await dynamicImport(specifier)) as Record<string, unknown>;
      if (specifier === "bun:sqlite" && typeof mod.Database === "function") {
        return new BunSqliteDatabase(new (mod.Database as new (path: string) => unknown)(file));
      }
      if (specifier === "node:sqlite" && typeof mod.DatabaseSync === "function") {
        return new NodeSqliteDatabase(
          new (mod.DatabaseSync as new (path: string) => unknown)(file),
        );
      }
    } catch {
      // Try the next runtime. Older Node and some bundled runtimes do not expose
      // a SQLite module, but the daemon can still run with in-memory sessions.
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
      all: (...params) =>
        (statement as { all: (...params: unknown[]) => unknown[] }).all(...params),
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
      all: (...params) =>
        (statement as { all: (...params: unknown[]) => unknown[] }).all(...params),
    };
  }

  close(): void {
    (this.db as { close?: () => void }).close?.();
  }
}

class ResilientSessionStore implements SessionStore {
  readonly kind: SessionStore["kind"];

  constructor(private readonly inner: SessionStore) {
    this.kind = inner.kind;
  }

  restoreActiveSessions(): StoredSession[] {
    try {
      return this.inner.restoreActiveSessions();
    } catch (err) {
      warnStoreError("restore sessions", err);
      return [];
    }
  }

  upsertSession(session: SessionPersistInput): void {
    this.write("persist session", () => this.inner.upsertSession(session));
  }

  markSessionEnded(
    token: string,
    endedAt: number,
    costSummary: string,
    costTotals: TokenUsage,
  ): void {
    this.write("mark session ended", () =>
      this.inner.markSessionEnded(token, endedAt, costSummary, costTotals),
    );
  }

  updateSessionPid(token: string, pid: number): void {
    this.write("update session pid", () => this.inner.updateSessionPid(token, pid));
  }

  updateSessionUsage(
    token: string,
    costSummary: string,
    costTotals: TokenUsage,
    externalSummary?: string,
  ): void {
    this.write("update session usage", () =>
      this.inner.updateSessionUsage(token, costSummary, costTotals, externalSummary),
    );
  }

  updateSessionLastSeen(token: string, lastSeenAt: number): void {
    this.write("update session last seen", () =>
      this.inner.updateSessionLastSeen(token, lastSeenAt),
    );
  }

  close(): void {
    try {
      this.inner.close();
    } catch (err) {
      warnStoreError("close session store", err);
    }
  }

  private write(action: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      warnStoreError(action, err);
    }
  }
}

function warnStoreError(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[togetherlink daemon] Could not ${action}: ${message}\n`);
}

class SqliteSessionStore implements SessionStore {
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
          token, agent, pid, started_at, last_seen_at, ended_at, model_label, api_key, base_url,
          auth_token,
          model_id, target_model_id, model_name, model_definition_json,
          claude_code_max_output_tokens, claude_code_max_output_tokens_user_set, debug,
          prompt_tokens, cached_tokens, completion_tokens, cost_usd, cost_summary,
          external_summary, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          agent = excluded.agent,
          pid = excluded.pid,
          started_at = excluded.started_at,
          last_seen_at = excluded.last_seen_at,
          ended_at = excluded.ended_at,
          model_label = excluded.model_label,
          api_key = excluded.api_key,
          base_url = excluded.base_url,
          auth_token = excluded.auth_token,
          model_id = excluded.model_id,
          target_model_id = excluded.target_model_id,
          model_name = excluded.model_name,
          model_definition_json = excluded.model_definition_json,
          claude_code_max_output_tokens = excluded.claude_code_max_output_tokens,
          claude_code_max_output_tokens_user_set = excluded.claude_code_max_output_tokens_user_set,
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

  markSessionEnded(
    token: string,
    endedAt: number,
    costSummary: string,
    costTotals: TokenUsage,
  ): void {
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
    this.db
      .prepare("UPDATE sessions SET pid = ?, updated_at = ? WHERE token = ?")
      .run(pid, Date.now(), token);
  }

  updateSessionUsage(
    token: string,
    costSummary: string,
    costTotals: TokenUsage,
    externalSummary?: string,
  ): void {
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

  updateSessionLastSeen(token: string, lastSeenAt: number): void {
    this.db
      .prepare("UPDATE sessions SET last_seen_at = ?, updated_at = ? WHERE token = ?")
      .run(lastSeenAt, Date.now(), token);
  }

  close(): void {
    this.db.close?.();
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pid INTEGER,
        started_at INTEGER NOT NULL,
        last_seen_at INTEGER,
        ended_at INTEGER,
        model_label TEXT NOT NULL,
        api_key TEXT NOT NULL,
        base_url TEXT,
        auth_token TEXT,
        model_id TEXT,
        target_model_id TEXT,
        model_name TEXT,
        model_definition_json TEXT NOT NULL,
        claude_code_max_output_tokens INTEGER,
        claude_code_max_output_tokens_user_set INTEGER,
        debug INTEGER,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        cost_summary TEXT NOT NULL DEFAULT '',
        external_summary TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at DESC);
    `);
    this.addColumnIfMissing("sessions", "last_seen_at", "INTEGER");
    this.addColumnIfMissing("sessions", "base_url", "TEXT");
    this.addColumnIfMissing("sessions", "claude_code_max_output_tokens", "INTEGER");
    this.addColumnIfMissing("sessions", "claude_code_max_output_tokens_user_set", "INTEGER");
  }

  private addColumnIfMissing(table: string, column: string, type: string): void {
    try {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {
      // Existing databases already have the column.
    }
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
    };
  }
}

class MemorySessionStore implements SessionStore {
  readonly kind = "memory";

  restoreActiveSessions(): StoredSession[] {
    return [];
  }

  upsertSession(): void {}

  markSessionEnded(): void {}

  updateSessionPid(): void {}

  updateSessionUsage(): void {}

  updateSessionLastSeen(): void {}

  close(): void {}
}

function sessionParams(session: SessionPersistInput, updatedAt: number): unknown[] {
  return [
    session.token,
    session.agent ?? "claude",
    session.pid ?? null,
    session.startedAt,
    session.lastSeenAt,
    session.endedAt ?? null,
    session.modelLabel,
    session.apiKey,
    session.baseUrl ?? null,
    session.authToken ?? null,
    session.modelId ?? null,
    session.targetModelId ?? null,
    session.modelName ?? null,
    JSON.stringify(session.modelDefinition),
    session.claudeCodeMaxOutputTokens ?? null,
    session.claudeCodeMaxOutputTokensUserSet === undefined
      ? null
      : session.claudeCodeMaxOutputTokensUserSet
        ? 1
        : 0,
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

type SessionRow = {
  token: string;
  agent: string;
  pid: number | null;
  started_at: number;
  last_seen_at: number | null;
  ended_at: number | null;
  model_label: string;
  api_key: string;
  base_url: string | null;
  auth_token: string | null;
  model_id: string | null;
  target_model_id: string | null;
  model_name: string | null;
  model_definition_json: string;
  claude_code_max_output_tokens: number | null;
  claude_code_max_output_tokens_user_set: number | null;
  debug: number | null;
  prompt_tokens: number;
  cached_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  cost_summary: string;
  external_summary: string | null;
};

function rowToSessionBase(row: SessionRow): StoredSession {
  return {
    token: row.token,
    agent: row.agent as AgentId,
    ...(typeof row.pid === "number" ? { pid: row.pid } : {}),
    apiKey: row.api_key,
    ...(row.base_url ? { baseUrl: row.base_url } : {}),
    ...(row.auth_token ? { authToken: row.auth_token } : {}),
    modelLabel: row.model_label,
    modelDefinition: parseJson(row.model_definition_json, {}) as StoredSession["modelDefinition"],
    ...(row.model_id ? { modelId: row.model_id } : {}),
    ...(row.target_model_id ? { targetModelId: row.target_model_id } : {}),
    ...(row.model_name ? { modelName: row.model_name } : {}),
    ...(typeof row.claude_code_max_output_tokens === "number"
      ? { claudeCodeMaxOutputTokens: row.claude_code_max_output_tokens }
      : {}),
    ...(row.claude_code_max_output_tokens_user_set !== null
      ? { claudeCodeMaxOutputTokensUserSet: row.claude_code_max_output_tokens_user_set === 1 }
      : {}),
    ...(row.debug !== null ? { debug: row.debug === 1 } : {}),
    startedAt: row.started_at,
    ...(typeof row.last_seen_at === "number" ? { lastSeenAt: row.last_seen_at } : {}),
    ...(typeof row.ended_at === "number" ? { endedAt: row.ended_at } : {}),
  };
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
