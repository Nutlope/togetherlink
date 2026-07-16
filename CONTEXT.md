# Domain Glossary — togetherlink

The ubiquitous language for the togetherlink CLI proxy/router. Terms here are
the canonical names for concepts in the codebase; architecture review and code
discussion should use these words exactly. Architecture vocabulary (module,
interface, depth, seam, adapter, leverage, locality) comes from the
`codebase-design` skill glossary.

## Agents (the harness families)

A **harness** is a Togetherlink adapter for one coding-agent CLI. There are two
architecturally distinct families (recorded as `ProxiedHarness` and
`SpawnedHarness` in `harness-types.ts`):

- **Proxied harness** — Claude, Codex. `run` spawns a daemon-backed proxy: it
  registers a session, starts a keepalive, routes `/v1/*` traffic through the
  daemon's Together client, tracks cost via a `CostTracker`, and deregisters on
  exit. The shared lifecycle lives in `runProxiedSession`
  (`packages/cli/src/lib/proxied-session.ts`).
- **Spawned harness** — OpenCode, Pi, Grok. `run` spawns the agent binary
  directly; the binary talks to Together using inline config (OpenCode), a
  temporary `models.json` (Pi), or an isolated temporary `GROK_HOME` (Grok).
  No daemon, no proxy, no `CostTracker`, no keepalive. The shared
  `runTrackedSpawnedSession` lifecycle records anonymous session start/end
  telemetry, but token and cost totals remain unavailable because Together
  traffic bypasses togetherlink.

**Harness** — anything that adapts one agent CLI to Togetherlink. _Avoid:_
integration, connector.

**HarnessId** — the enum of harness identifiers (`claude`, `codex`, `grok`,
`opencode`, `pi`). Note: the daemon also knows about `codex-app`, an agent id not in
`HarnessId` — an orphan to be reconciled.

## The daemon seam

**Daemon** — the shared, persistent local proxy process (`daemon/server.ts`).
One process serves every proxied session: each registers its token +
credentials at `POST /internal/sessions`, and the daemon resolves every
`/v1/*` request to that session by the presented Bearer token.

**Session** — a registered proxied-harness invocation. A session carries its
own Together `apiKey`, model, and `CostTracker`; the daemon owns the session
registry (`SessionRegistry` in `daemon/state.ts`).

**SessionRegistry** — the in-memory + sqlite-backed registry of active
sessions. Exported and injectable into `runDaemon` so it's testable in
isolation (#5: the interface is the test surface).

**SessionStore** — the persistence adapter behind the registry
(`daemon/storage.ts`). Deep module: hides Bun/Node sqlite detection, the schema,
migrations, and resilience behind a 7-method interface.

## The Together client seam

**Together client** (`together-client.ts`) — the deep HTTP client for
`POST /chat/completions`. Owns the fetch + 429/503 retry loop + backoff. Each
harness's `together-call.ts` maps the response to its own wire-format error
shape on top (Anthropic vs OpenAI Responses).

**Wire format** — the request/response shape an agent CLI speaks. Claude speaks
the Anthropic Messages API (`/v1/messages`); Codex speaks the OpenAI Responses
API (`/v1/responses`). The translation lives in each harness's
`translate-request.ts` / `translate-response.ts` / `stream.ts`.

**Error contract** — each harness renders errors in its own wire shape. The
daemon's catch-all dispatches by `session.agent` and renders Anthropic errors
for Claude, OpenAI errors for Codex (#2: was a bug — Codex errors were
mis-rendered as Anthropic).

## Cross-cutting

**CostTracker** (`cost.ts`, shared) — proxy-side token + dollar tracking using
the selected model's rates. Self-calibrating token estimator. Lives at the
shared seam (not under any harness tree).

**proxied-session** (`proxied-session.ts`) — the shared 15-step lifecycle for a
proxied harness: model resolve → daemon → register → telemetry → banner →
spawn → pid update → keepalive → await exit → cost print → deregister.

**spawned-session** (`spawned-session.ts`) — the shared process + lifecycle
telemetry boundary for OpenCode, Pi, and Grok. It records which harness and
model started/ended without claiming visibility into direct API usage.

**paths** (`paths.ts`, shared) — the single source of truth for the togetherlink
home directory + process-liveness check. Replaces 4+3 duplicated copies.

## Sources of truth

- Architecture vocabulary: `codebase-design` skill glossary.
- ADRs: none yet (create `docs/adr/` when a decision is load-bearing).
- This file is the domain model; update it as terms crystallize.
