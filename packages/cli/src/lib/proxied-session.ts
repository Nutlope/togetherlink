import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { ModelDefinition } from "@togetherlink/models";
import {
  daemonFetch,
  daemonSessionUrl,
  ensureDaemon,
  localProxyAuthToken,
  registerDaemonSession,
  startDaemonSessionKeepalive,
  updateDaemonSessionPid,
} from "./daemon/launch.js";
import { sendTelemetryEvent, randomSessionId } from "./telemetry.js";
import type { RegisterSessionRequest } from "./daemon/state.js";

/**
 * The proxied-session lifecycle — the deep module behind
 * `runClaudeTogether` and `runCodexTogether`. Those two were ~90% identical
 * control flow (the same 15-step recipe: model resolve → daemon → register →
 * telemetry start → banner → spawn → pid update → keepalive → await exit →
 * cost print → deregister → telemetry end). Carved out so the lifecycle lives
 * in one place; each harness passes a spec with only its genuine deltas
 * (agent id, banner, env/arg builder, optional catalog hook).
 *
 * Spawn harnesses (Pi, OpenCode) never touch this — they don't use the daemon.
 */

export type ProxiedSessionResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
};

export type ProxiedSessionUsage = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type SessionCostResult = {
  usage?: ProxiedSessionUsage;
  usageByModel?: Array<{
    model: string;
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    costUsd: number;
  }>;
};

export type ProxiedSessionSpec = {
  /** The agent id ("claude" / "codex") — used for registration + telemetry. */
  agent: "claude" | "codex";
  apiKey: string;
  /** Resolved model: the id Together expects + the human name for the banner. */
  modelId: string;
  targetModelId: string;
  modelName: string;
  modelDefinition: ModelDefinition;
  /** Extra registration-only model id (Claude uses an alias; Codex uses the same id). */
  registrationModelId?: string;
  /** Agent-specific registration metadata that should be visible to the daemon proxy. */
  extraRegistration?: Pick<
    RegisterSessionRequest,
    "claudeCodeMaxOutputTokens" | "claudeCodeMaxOutputTokensUserSet"
  >;
  args?: string[];
  /** Optional pre-spawn hook (Codex uses it to write the model catalog);
   * its return value is threaded into the buildArgs/buildEnv context. */
  beforeSpawn?: () => Promise<unknown> | unknown;
  /** Build the env for the spawned agent binary. */
  buildEnv: (context: {
    proxyUrl: string;
    authToken: string;
    modelId: string;
    modelName: string;
    beforeSpawnResult?: unknown;
  }) => NodeJS.ProcessEnv;
  /** Build the args for the spawned agent binary. */
  buildArgs: (context: {
    proxyUrl: string;
    authToken: string;
    modelId: string;
    args: string[];
    beforeSpawnResult?: unknown;
  }) => string[];
  /** The binary to spawn (claude / codex). */
  binary: string;
  /** Banner line written to stderr so the user knows this routes to Together. */
  banner: (modelName: string) => string;
  /** Label for keepalive logging (e.g. "Claude session"). */
  keepaliveLabel: string;
  /** Optional post-deregister hook (Codex uses it to clean up the catalog). */
  afterDeregister?: () => Promise<void> | void;
};

export async function runProxiedSession(spec: ProxiedSessionSpec): Promise<ProxiedSessionResult> {
  const debug = process.env.TOGETHERLINK_DEBUG === "1";
  const sessionId = randomLocalProxyToken();
  const authToken = await localProxyAuthToken();
  const telemetrySessionId = randomSessionId();

  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionId);

  const registration: RegisterSessionRequest = {
    token: sessionId,
    authToken,
    agent: spec.agent,
    apiKey: spec.apiKey,
    modelLabel: spec.modelName,
    modelId: spec.registrationModelId ?? spec.modelId,
    targetModelId: spec.targetModelId,
    modelName: spec.modelName,
    modelDefinition: spec.modelDefinition,
    ...(debug ? { debug: true } : {}),
    ...spec.extraRegistration,
  };
  try {
    await registerDaemonSession(proxyUrl, registration);
  } catch (err) {
    throw new Error(
      `Could not register this ${spec.agent === "claude" ? "Claude" : "Codex"} session with the togetherlink daemon: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const startedAt = Date.now();
  void sendTelemetryEvent({
    event: "session_started",
    sessionId: telemetrySessionId,
    agent: spec.agent,
    initialModel: spec.targetModelId,
    startedAt,
  });

  process.stderr.write(spec.banner(spec.modelName));
  if (debug) {
    process.stderr.write(`[togetherlink proxy] daemon: ${proxyUrl}\n`);
    process.stderr.write(`[togetherlink proxy] session: ${agentProxyUrl}\n`);
    process.stderr.write(`[togetherlink ${spec.agent}] model: ${spec.modelId}\n`);
  }

  const beforeSpawnResult = spec.beforeSpawn ? await spec.beforeSpawn() : undefined;

  const child = spawn(
    spec.binary,
    spec.buildArgs({
      proxyUrl: agentProxyUrl,
      authToken,
      modelId: spec.modelId,
      args: spec.args ?? [],
      beforeSpawnResult,
    }),
    {
      env: spec.buildEnv({
        proxyUrl: agentProxyUrl,
        authToken,
        modelId: spec.modelId,
        modelName: spec.modelName,
        beforeSpawnResult,
      }),
      stdio: "inherit",
    },
  );

  if (typeof child.pid === "number") {
    try {
      await updateDaemonSessionPid(proxyUrl, sessionId, child.pid);
    } catch {
      // best-effort
    }
  }
  const keepalive = startDaemonSessionKeepalive(registration, {
    ...(typeof child.pid === "number" ? { pid: child.pid } : {}),
    debug,
    label: spec.keepaliveLabel,
  });

  const result = await new Promise<ProxiedSessionResult>((resolve) => {
    child.on("error", (err) => {
      process.stderr.write(`togetherlink ▸ Failed to launch ${spec.binary}: ${err.message}.\n`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });

  const { usage, usageByModel } = await printSessionCost(proxyUrl, sessionId);
  keepalive.stop();
  try {
    await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  } catch {
    // best-effort
  }
  if (spec.afterDeregister) {
    await spec.afterDeregister();
  }

  const endedAt = Date.now();
  void sendTelemetryEvent({
    event: "session_ended",
    sessionId: telemetrySessionId,
    agent: spec.agent,
    initialModel: spec.targetModelId,
    finalModel: spec.targetModelId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    ...(usage ? { usage } : {}),
    ...(usageByModel && usageByModel.length > 0 ? { usageByModel } : {}),
    ...(typeof result.status === "number" ? { exitCode: result.status } : {}),
    ...(result.signal ? { signal: result.signal } : {}),
  });

  return result;
}

export async function printSessionCost(
  proxyUrl: string,
  authToken: string,
): Promise<SessionCostResult> {
  try {
    const response = await daemonFetch(
      `${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}/cost`,
    );
    if (response.ok) {
      const { summary, totals, totalsByModel } = (await response.json()) as {
        summary?: string;
        totals?: ProxiedSessionUsage;
        totalsByModel?: Array<{
          model: string;
          promptTokens: number;
          cachedTokens: number;
          completionTokens: number;
          costUsd: number;
        }>;
      };
      if (summary) {
        process.stderr.write(`${summary}\n`);
      }
      return {
        ...(totals ? { usage: totals } : {}),
        ...(totalsByModel ? { usageByModel: totalsByModel } : {}),
      };
    }
  } catch {
    // Daemon gone, unreachable, or timed out: skip the cost line rather than
    // fail the command (or hang it — daemonFetch bounds the wait).
  }
  return {};
}

export function randomLocalProxyToken(): string {
  return `togetherlink-${randomBytes(24).toString("base64url")}`;
}
