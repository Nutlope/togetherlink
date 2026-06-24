import { CostTracker } from "../claude/cost.js";
import type { ClaudeProxyOptions, ModelDefinition } from "../claude/proxy.js";
import type { CodexProxyOptions } from "../codex/proxy.js";

/**
 * Which coding agent a session belongs to. The dashboard groups by this, and
 * it selects how cost is tracked:
 * - `claude`: the daemon PROXIES the agent's traffic (it
 *   speaks Anthropic shape; the daemon translates to Together's OpenAI shape),
 *   so the daemon owns the `CostTracker` and accounts tokens as they flow.
 * - `opencode`: the agent runs DIRECT to Together (no proxy — the `@ai-sdk/
 *   togetherai` adapter knows Together's URL, and OpenCode handles images
 *   natively). The daemon only holds a `CostTracker` the launcher self-reports
 *   into at exit (via `opencode stats`), so the dashboard can show it.
 * - `codex`: the daemon PROXIES OpenAI Responses-shaped Codex traffic and
 *   translates it to Together chat completions.
 */
export type AgentId = "claude" | "opencode" | "codex";

/**
 * One live coding-agent session, keyed by the random auth token the launcher
 * minted. The token doubles as the session identity: the launcher registers it
 * with the daemon before spawning the agent, and (for proxied agents) every
 * request the agent makes carries it as `Authorization: Bearer <token>`, so the
 * daemon resolves a request to its owning session with no other routing signal.
 *
 * Agent-neutral core fields (`apiKey`, `modelDefinition`, `costTracker`,
 * `modelLabel`) live on the state directly so both proxied and self-reporting
 * agents share one cost/dashboard path. `options` is the fully-formed
 * proxy options the handler needs — only meaningful for proxied agents; for
 * self-reporting agents it's undefined (the proxy handler is never called for
 * them, since their traffic never reaches the daemon).
 *
 * This registry is the seam the local dashboard reads — keep it a clean, typed
 * singleton.
 */
export type SessionState = {
  token: string;
  agent: AgentId;
  /** agent child pid, if the launcher supplied it at register time. */
  pid?: number;
  startedAt: number;
  /** Display label for the dashboard, e.g. "GLM 5.2". */
  modelLabel: string;
  /** Real Together API key the daemon uses upstream (proxied) or that the
   *  self-reporting agent used direct. Never returned by any read endpoint. */
  apiKey: string;
  modelDefinition: ModelDefinition;
  costTracker: CostTracker;
  debug?: boolean;
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
};

/**
 * Body of `POST /internal/sessions`. The agent-neutral core (`token`, `pid`,
 * `apiKey`, `modelDefinition`, `modelLabel`, `agent`, `debug`) is always
 * required; the Claude-specific model fields (`modelId`, `targetModelId`,
 * `modelName`) are only required for proxied agents and feed `ClaudeProxyOptions`.
 */
export type RegisterSessionRequest = {
  token: string;
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

export type RegisterSessionResult =
  | { ok: true; session: SessionPublicView }
  | { ok: false; error: string };

/** Body of `POST /internal/sessions/:token/usage` (self-report cost). */
export type UsageReportRequest = {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  /** Optional verbatim summary the dashboard can show (e.g. opencode stats line). */
  summary?: string;
};

class SessionRegistry {
  private readonly map = new Map<string, SessionState>();

  register(state: SessionState): void {
    this.map.set(state.token, state);
  }

  get(token: string): SessionState | undefined {
    return this.map.get(token);
  }

  delete(token: string): boolean {
    return this.map.delete(token);
  }

  get size(): number {
    return this.map.size;
  }

  list(): SessionState[] {
    return [...this.map.values()];
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
        this.map.delete(state.token);
        removed += 1;
      }
    }
    return removed;
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
const PROXIED_AGENTS = new Set<AgentId>(["claude", "codex"]);

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
      authToken: req.token,
      ...(req.debug !== undefined ? { debug: req.debug } : {}),
      costTracker,
    };
  }
  return state;
}
