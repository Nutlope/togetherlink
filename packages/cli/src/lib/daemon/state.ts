import { CostTracker } from "../claude/cost.js";
import type { ClaudeProxyOptions, ModelDefinition } from "../claude/proxy.js";
import type { CodexProxyOptions } from "../codex/proxy.js";
import { sendTelemetryEvent } from "../telemetry.js";
import {
  createSessionStore,
  type SessionPersistInput,
  type SessionStore,
  type StoredSession,
} from "./storage.js";

/**
 * Which coding agent a session belongs to. This selects how cost is tracked:
 * - `claude`: the daemon PROXIES the agent's traffic (it
 *   speaks Anthropic shape; the daemon translates to Together's OpenAI shape),
 *   so the daemon owns the `CostTracker` and accounts tokens as they flow.
 * - `opencode`: the agent runs DIRECT to Together (no proxy — the `@ai-sdk/
 *   togetherai` adapter knows Together's URL, and OpenCode handles images
 *   natively). The daemon only holds a `CostTracker` the launcher self-reports
 *   into at exit (via `opencode stats`).
 * - `codex`: the daemon PROXIES OpenAI Responses-shaped Codex CLI traffic and
 *   translates it to Together chat completions.
 * - `codex-app`: same proxy path as `codex`, but registered by the persistent
 *   Codex Desktop app integration so telemetry can distinguish it.
 */
export type AgentId = "claude" | "opencode" | "codex" | "codex-app";

/**
 * One live coding-agent session, keyed by the random auth token the launcher
 * minted. The token doubles as the session identity: the launcher registers it
 * with the daemon before spawning the agent, and (for proxied agents) every
 * request the agent makes carries it as `Authorization: Bearer <token>`, so the
 * daemon resolves a request to its owning session with no other routing signal.
 *
 * Agent-neutral core fields (`apiKey`, `modelDefinition`, `costTracker`,
 * `modelLabel`) live on the state directly so both proxied and self-reporting
 * agents share one cost path. `options` is the fully-formed
 * proxy options the handler needs — only meaningful for proxied agents; for
 * self-reporting agents it's undefined (the proxy handler is never called for
 * them, since their traffic never reaches the daemon).
 */
export type SessionState = {
  token: string;
  agent: AgentId;
  /** agent child pid, if the launcher supplied it at register time. */
  pid?: number;
  startedAt: number;
  endedAt?: number;
  /** Display label for local session status, e.g. "GLM 5.2". */
  modelLabel: string;
  /** Real Together API key the daemon uses upstream (proxied) or that the
   *  self-reporting agent used direct. Never returned by any read endpoint. */
  apiKey: string;
  modelDefinition: ModelDefinition;
  costTracker: CostTracker;
  debug?: boolean;
  externalSummary?: string;
  /**
   * Only for proxied agents. The matching proxy handler is called with this.
   * Undefined for self-reporting agents.
   */
  options?: ClaudeProxyOptions | CodexProxyOptions;
};

export type SessionPublicView = {
  agent: AgentId;
  modelLabel: string;
  pid?: number;
  startedAt: number;
  endedAt?: number;
  status: "running" | "ended";
  costSummary: string;
};

/**
 * Body of `POST /internal/sessions`. The agent-neutral core (`token`, `pid`,
 * `apiKey`, `modelDefinition`, `modelLabel`, `agent`, `debug`) is always
 * required; the Claude-specific model fields (`modelId`, `targetModelId`,
 * `modelName`) are only required for proxied agents and feed `ClaudeProxyOptions`.
 */
export type RegisterSessionRequest = {
  /** Session routing id. In older builds this also doubled as the auth token. */
  token: string;
  /** Stable local proxy auth token. Defaults to `token` for old launchers. */
  authToken?: string;
  agent?: AgentId;
  pid?: number;
  apiKey: string;
  modelLabel: string;
  modelDefinition: ModelDefinition;
  /** Proxied-agent model alias/target for proxy routing. */
  modelId?: string;
  targetModelId?: string;
  /** Included for proxy options. Defaults to modelLabel. */
  modelName?: string;
  debug?: boolean;
};

type PersistedSession = SessionPersistInput;

export type RegisterSessionResult =
  | { ok: true; session: SessionPublicView }
  | { ok: false; error: string };

/** Body of `POST /internal/sessions/:token/usage` (self-report cost). */
export type UsageReportRequest = {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  /** Optional verbatim summary for end-of-session cost output (e.g. opencode stats line). */
  summary?: string;
};

class SessionRegistry {
  private readonly map = new Map<string, SessionState>();
  private store: SessionStore | undefined;

  register(state: SessionState): void {
    this.map.set(state.token, state);
    this.persistSession(state);
  }

  get(token: string): SessionState | undefined {
    return this.map.get(token);
  }

  delete(token: string): boolean {
    const state = this.map.get(token);
    if (!state) {
      return false;
    }
    this.map.delete(token);
    state.endedAt = Date.now();
    this.store?.markSessionEnded(state.token, state.endedAt, state.costTracker.summarize(), state.costTracker.totals);
    emitDaemonSessionEndedTelemetry(state);
    return true;
  }

  get size(): number {
    return this.map.size;
  }

  list(): SessionState[] {
    return [...this.map.values()];
  }

  updatePid(token: string, pid: number): boolean {
    const state = this.map.get(token);
    if (!state) {
      return false;
    }
    state.pid = pid;
    this.store?.updateSessionPid(token, pid);
    return true;
  }

  async restorePersisted(): Promise<number> {
    this.store = await createSessionStore();
    const persisted = this.store.restoreActiveSessions();
    let restored = 0;
    for (const session of persisted) {
      if (session.pid !== undefined && !isAlive(session.pid)) {
        this.store.markSessionEnded(
          session.token,
          Date.now(),
          "[togetherlink cost] session total: $0.0000 (0 in, 0 out)",
          { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 },
        );
        continue;
      }
      const state = buildSession(session);
      state.startedAt = session.startedAt;
      if (session.externalSummary !== undefined) {
        state.externalSummary = session.externalSummary;
      }
      state.costTracker.hydrateUsage(
        {
          promptTokens: session.promptTokens ?? 0,
          cachedTokens: session.cachedTokens ?? 0,
          completionTokens: session.completionTokens ?? 0,
          costUsd: session.costUsd ?? 0,
        },
        session.externalSummary,
      );
      this.map.set(state.token, state);
      restored += 1;
    }
    return restored;
  }

  /**
   * Drop sessions whose owning launcher is gone. A session registered with a
   * `pid` (the agent child) is reaped when that pid is no longer alive — covers
   * the kill -9 / terminal-closed case where the launcher never gets to call
   * DELETE. Sessions registered without a pid, or whose pid is owned by another
   * user (EPERM — can't tell if alive), are left alone; they're reaped by
   * deregister on the normal exit path, and a long-lived orphan there is a
   * bounded, small per-session cost rather than an unbounded leak.
   */
  reapDead(): number {
    let removed = 0;
    for (const state of this.map.values()) {
      if (state.pid === undefined) {
        continue;
      }
      if (!isAlive(state.pid)) {
        this.delete(state.token);
        removed += 1;
      }
    }
    return removed;
  }

  updateUsage(token: string, externalSummary?: string): void {
    const state = this.map.get(token);
    if (!state) {
      return;
    }
    if (externalSummary) {
      state.externalSummary = externalSummary;
    }
    this.store?.updateSessionUsage(token, state.costTracker.summarize(), state.costTracker.totals, state.externalSummary);
  }

  closeStore(): void {
    this.store?.close();
    this.store = undefined;
  }

  private persistSession(state: SessionState): void {
    this.store?.upsertSession(toPersistedSession(state));
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process (dead) → not alive. EPERM = exists but not ours
    // → treat as alive so we don't reap a session we can't verify.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Process-wide singleton; only the daemon process ever mutates this. */
export const sessions = new SessionRegistry();

/** Agents whose traffic the daemon proxies (vs. self-reporting cost). */
const PROXIED_AGENTS = new Set<AgentId>(["claude", "codex", "codex-app"]);

export function isProxiedAgent(agent: AgentId): boolean {
  return PROXIED_AGENTS.has(agent);
}

/**
 * Build a per-session `SessionState` from a register body. Proxied agents get
 * fully-formed proxy options; self-reporting agents get `options` undefined
 * (the proxy handler is never called for them).
 */
export function buildSession(req: RegisterSessionRequest): SessionState {
  const agent: AgentId = req.agent ?? "claude";
  const costTracker = new CostTracker(req.modelDefinition);
  const state: SessionState = {
    token: req.token,
    agent,
    startedAt: Date.now(),
    modelLabel: req.modelLabel,
    apiKey: req.apiKey,
    modelDefinition: req.modelDefinition,
    costTracker,
    ...(typeof req.pid === "number" ? { pid: req.pid } : {}),
    ...(req.debug !== undefined ? { debug: req.debug } : {}),
  };
  if (isProxiedAgent(agent)) {
    state.options = {
      apiKey: req.apiKey,
      modelId: req.modelId ?? req.modelLabel,
      targetModelId: req.targetModelId ?? req.modelDefinition.id,
      modelName: req.modelName ?? req.modelLabel,
      modelDefinition: req.modelDefinition,
      authToken: req.authToken ?? req.token,
      ...(req.debug !== undefined ? { debug: req.debug } : {}),
      costTracker,
    };
  }
  return state;
}

export function toPublicSessionView(state: SessionState): SessionPublicView {
  return {
    agent: state.agent,
    modelLabel: state.modelLabel,
    ...(state.pid !== undefined ? { pid: state.pid } : {}),
    startedAt: state.startedAt,
    ...(state.endedAt !== undefined ? { endedAt: state.endedAt } : {}),
    status: state.endedAt === undefined ? "running" : "ended",
    costSummary: state.costTracker.summarize(),
  };
}

function toPersistedSession(state: SessionState): PersistedSession {
  const base: PersistedSession = {
    token: state.token,
    agent: state.agent,
    apiKey: state.apiKey,
    ...(state.options?.authToken !== undefined && state.options.authToken !== state.token ? { authToken: state.options.authToken } : {}),
    modelLabel: state.modelLabel,
    modelDefinition: state.modelDefinition,
    startedAt: state.startedAt,
    costSummary: state.costTracker.summarize(),
    costTotals: state.costTracker.totals,
    ...(state.pid !== undefined ? { pid: state.pid } : {}),
    ...(state.endedAt !== undefined ? { endedAt: state.endedAt } : {}),
    ...(state.externalSummary !== undefined ? { externalSummary: state.externalSummary } : {}),
    ...(state.debug !== undefined ? { debug: state.debug } : {}),
  };
  if (state.options !== undefined) {
    base.modelId = state.options.modelId;
    base.targetModelId = state.options.targetModelId;
    base.modelName = state.options.modelName;
  }
  return base;
}

function storedSessionToPersistInput(session: StoredSession): SessionPersistInput {
  return {
    ...session,
    costSummary: session.externalSummary ?? "[togetherlink cost] session total: $0.0000 (0 in, 0 out)",
    costTotals: {
      promptTokens: session.promptTokens ?? 0,
      cachedTokens: session.cachedTokens ?? 0,
      completionTokens: session.completionTokens ?? 0,
      costUsd: session.costUsd ?? 0,
    },
  };
}

function emitDaemonSessionEndedTelemetry(state: SessionState): void {
  if (state.agent !== "codex-app" || state.endedAt === undefined) {
    return;
  }
  const usageByModel = state.costTracker.totalsByModel;
  const fallbackModel = state.options?.targetModelId ?? state.modelDefinition.id;
  void sendTelemetryEvent({
    event: "session_ended",
    sessionId: state.token,
    agent: state.agent,
    initialModel: fallbackModel,
    finalModel: fallbackModel,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    durationMs: state.endedAt - state.startedAt,
    usage: state.costTracker.totals,
    ...(usageByModel.length > 0 ? { usageByModel } : {}),
    metadata: {
      integration: "codex-app",
      emittedBy: "daemon",
    },
  });
}
