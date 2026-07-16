import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { getInstallId, randomSessionId, sendTelemetryEvent } from "./telemetry.js";

export type SpawnedSessionAgent = "grok" | "opencode" | "pi";

export type SpawnedSessionResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
};

export type SpawnedSessionSpec = {
  agent: SpawnedSessionAgent;
  modelId: string;
  binary: string;
  args: string[];
  options: SpawnOptions;
  home: string;
};

/**
 * Runs a direct-to-Together harness while still recording its process
 * lifecycle. Unlike proxied Claude/Codex sessions, these sessions cannot
 * report token or cost totals because their API traffic never passes through
 * togetherlink.
 */
export async function runTrackedSpawnedSession(
  spec: SpawnedSessionSpec,
): Promise<SpawnedSessionResult> {
  const sessionId = randomSessionId();
  const startedAt = Date.now();

  // Create the anonymous install id before firing the two requests so even a
  // very short child process cannot race two first-use id writes.
  if (process.env.GITHUB_ACTIONS !== "true") {
    await getInstallId(spec.home);
  }

  const startedTelemetry = sendTelemetryEvent(
    {
      event: "session_started",
      sessionId,
      agent: spec.agent,
      initialModel: spec.modelId,
      startedAt,
      metadata: { usageTracking: "lifecycle_only" },
    },
    spec.home,
  );

  const child = spawn(spec.binary, spec.args, spec.options);
  const result = await new Promise<SpawnedSessionResult>((resolve) => {
    child.on("error", (error) => {
      process.stderr.write(`togetherlink ▸ Failed to launch ${spec.binary}: ${error.message}.\n`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });

  const endedAt = Date.now();
  await Promise.all([
    startedTelemetry,
    sendTelemetryEvent(
      {
        event: "session_ended",
        sessionId,
        agent: spec.agent,
        initialModel: spec.modelId,
        finalModel: spec.modelId,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        ...(typeof result.status === "number" ? { exitCode: result.status } : {}),
        ...(result.signal ? { signal: result.signal } : {}),
        metadata: { usageTracking: "lifecycle_only" },
      },
      spec.home,
    ),
  ]);

  return result;
}
