import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJsonIfExists, writeJsonAtomic } from "./together-core.js";
import { togetherlinkHome } from "./global-config.js";
import { VERSION } from "./version.js";

const TELEMETRY_ENDPOINT =
  process.env.TOGETHERLINK_TELEMETRY_URL ?? "https://togetherlink.vercel.app/api/telemetry";
const TELEMETRY_TIMEOUT_MS = 2000;

export type TelemetryEventType =
  | "install_completed"
  | "cli_started"
  | "session_started"
  | "session_ended"
  | "context_trim";

/**
 * Structured payload for a `context_trim` event. A trim firing means the
 * proxy lossily shortened conversation input to fit a model's context window
 * — compaction is the harness's job, so every firing is a bug report against
 * our advertised limits / count_tokens accuracy (see TURN.md 1e/1f). Sent
 * fire-and-forget exactly like the lifecycle events.
 */
export type ContextTrimTelemetryInfo = {
  /** Which trim path fired. */
  path: "preemptive" | "retry";
  /** Model id the input was trimmed to fit (Together target model id). */
  model: string;
  /** Number of conversation chars dropped by the trim. */
  trimmedChars: number;
  /** Estimated (preemptive) or parsed-exact (retry) input token count. */
  inputTokens: number;
  /** Model context window in tokens. */
  contextWindow: number;
  /** Which fit rung the reactive orchestrator applied, when known. */
  action?: "max_tokens" | "strip_images" | "trim_text" | "drop_turns" | undefined;
  /**
   * True when the cumulative drop for this request exceeded the hard-warn
   * threshold (a large fraction of the conversation had to be discarded to
   * fit). Signals compaction timing is badly off, not just marginally.
   */
  hard?: boolean;
};

export type TelemetryUsage = {
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd?: number;
};

export type TelemetryModelUsage = TelemetryUsage & { model: string };

export type TelemetryEvent = {
  sessionId?: string;
  event: TelemetryEventType;
  agent?: string;
  initialModel?: string;
  finalModel?: string;
  model?: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  usage?: TelemetryUsage;
  // Per-model usage breakdown for the session, e.g. when Claude Code's
  // /model picker switches tiers mid-session without relaunching. Falls back
  // to initialModel/finalModel on the backend when absent (older CLI builds).
  usageByModel?: TelemetryModelUsage[];
  metadata?: Record<string, unknown>;
  exitCode?: number;
  signal?: string;
  errorKind?: string;
  /** Present on `context_trim` events. */
  contextTrim?: ContextTrimTelemetryInfo;
};

function installIdPath(home = os.homedir()): string {
  return path.join(togetherlinkHome(home), "install-id");
}

function telemetryDisabledByEnvironment(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
}

/**
 * Reads the stable anonymous install id, creating one on first use. The id is
 * a random UUID (no hardware fingerprinting) so analytics can measure
 * installs/sessions without collecting device identifiers.
 */
export async function getInstallId(home = os.homedir()): Promise<string> {
  const filePath = installIdPath(home);
  const existing = await readJsonIfExists<{ id?: string }>(filePath);
  if (existing.id) {
    return existing.id;
  }
  const id = randomUUID();
  await writeJsonAtomic(filePath, { id });
  return id;
}

function normalizedOs(): "macos" | "linux" | "windows" | "unknown" {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}

/**
 * Best-effort, bounded-timeout telemetry send. Never throws and never delays
 * the caller past the timeout — a failed or unreachable endpoint must not
 * break or noticeably slow down any CLI command.
 */
export async function sendTelemetryEvent(
  event: TelemetryEvent,
  home = os.homedir(),
): Promise<void> {
  if (telemetryDisabledByEnvironment()) {
    return;
  }

  try {
    const installId = await getInstallId(home);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);
    try {
      await fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installId,
          version: VERSION,
          os: normalizedOs(),
          arch: process.arch,
          ...event,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Best-effort: telemetry must never fail or block the user's command.
  }
}

export function randomSessionId(): string {
  return randomUUID();
}
