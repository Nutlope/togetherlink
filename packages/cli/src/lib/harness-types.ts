import type { HarnessId } from "./harness.js";

export type HarnessContext = {
  home: string;
  apiKey?: string;
  apiKeyFromFlag?: boolean;
  main?: string;
  passthrough?: string[];
  json?: boolean;
  restore?: boolean;
  search?: string;
  slot?: string;
};

export type HarnessResult = {
  message?: string;
  payload?: Record<string, unknown>;
};

export type Harness = {
  id: HarnessId;
  label: string;
  run: (ctx: HarnessContext) => Promise<HarnessResult>;
};

/**
 * Defines a harness adapter. Throws early (at module load) if a harness is
 * missing a required method, rather than failing confusingly at dispatch
 * time.
 */
export function defineHarness(impl: Harness): Harness {
  if (typeof impl.run !== "function") {
    throw new Error(`Harness "${impl.id}" is missing required method "run"`);
  }
  return impl;
}

/**
 * The two harness families (#8). The single `Harness.run` signature hides two
 * architecturally different shapes behind one interface:
 *
 * - **Proxied** — Claude, Codex. `run` spawns a daemon-backed proxy: it
 *   registers a session, starts a keepalive, proxies /v1/* traffic through the
 *   daemon's Together client, tracks cost via a CostTracker, and deregisters
 *   on exit. The lifecycle lives in `runProxiedSession` (proxied-session.ts).
 *
 * - **Spawned** — OpenCode, Grok, Pi. `run` spawns the agent binary directly;
 *   the binary talks to Together using inline config (OpenCode), a local
 *   metadata-only model catalog (Grok), or a models.json on disk (Pi). No
 *   inference proxy, no CostTracker, no keepalive.
 *
 * The split is documented here and in CONTEXT.md but is not currently enforced
 * in the type system — the former `ProxiedHarness`/`SpawnedHarness` type
 * declarations were unused and have been removed. See PLAN.md "Improvement
 * Backlog" for re-introducing them as enforced types. The orphan "codex-app"
 * agent id the daemon knows about (absent from HarnessId) is surfaced for
 * future reconciliation.
 */
