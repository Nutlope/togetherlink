import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  CLAUDE_HAIKU_MODEL_SELECTION,
  CLAUDE_MODEL_CAPABILITIES,
  CLAUDE_SUPPORTED_MODELS,
  resolveClaudeModel,
  type ClaudeModelSelection,
} from "./defaults.js";
import {
  ensureDaemon,
  daemonFetch,
  registerDaemonSession,
  updateDaemonSessionPid,
  startDaemonSessionKeepalive,
  localProxyAuthToken,
  daemonSessionUrl,
} from "../daemon/launch.js";
import { sendTelemetryEvent, randomSessionId } from "../telemetry.js";

const CONFLICTING_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
  "ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME",
  "ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION",
  "ANTHROPIC_CUSTOM_MODEL_OPTION",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES",
] as const;

export type ClaudeLaunchOptions = {
  apiKey: string;
  modelId?: string;
  args?: string[];
};

export type ClaudeLaunchResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
};

export function buildClaudeEnv({
  apiKey,
  modelId,
  proxyUrl,
  authToken,
}: ClaudeLaunchOptions & { modelId: string; modelName: string; proxyUrl: string; authToken: string }): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of CONFLICTING_ENV_KEYS) {
    delete env[key];
  }
  env.ANTHROPIC_BASE_URL = proxyUrl;
  // Use bearer-token mode for local proxy auth. Claude Code treats
  // ANTHROPIC_API_KEY as a user-supplied provider key and prompts about it;
  // ANTHROPIC_AUTH_TOKEN still sends Authorization: Bearer <token> to our
  // local daemon without entering that custom-key flow.
  env.ANTHROPIC_AUTH_TOKEN = authToken;
  env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1";
  env.ANTHROPIC_MODEL = modelId;
  applyClaudeModelMenuEnv(env, modelId);

  // Disable Claude Code's periodic "How is Claude doing this session?" survey.
  // It's an internal TUI prompt (not a request the proxy could intercept), and
  // its rating rides on Anthropic's telemetry channel — which bypasses our proxy
  // entirely, so it can't be captured. Default to off; only respect an explicit
  // user opt-in (e.g. "1" re-enables). Uses the targeted kill switch rather than
  // DISABLE_TELEMETRY so we don't also suppress error reporting / auto-updater.
  if (env.CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY === undefined) {
    env.CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = "1";
  }

  // Disable the `/feedback` slash command. `/feedback` posts a transcript +
  // report straight to a first-party Anthropic endpoint (api.anthropic.com,
  // landing in their `claude_cli_feedback` table) — it does NOT route through
  // ANTHROPIC_BASE_URL / our proxy, so we can neither capture nor honor it. The
  // binary even tags third-party providers as a reason feedback is unavailable.
  // Disable it so users aren't offered a feedback channel that silently reports
  // to Anthropic instead of to togetherlink. The dedicated kill switch (not
  // DISABLE_FEEDBACK_COMMAND's sibling DISABLE_TELEMETRY) leaves bug reports /
  // diagnostics untouched. Default off; respect an explicit "0"/"" opt-in.
  // See TODO.md "Custom `/togetherlink-feedback` command" for the replacement.
  if (env.DISABLE_FEEDBACK_COMMAND === undefined) {
    env.DISABLE_FEEDBACK_COMMAND = "1";
  }
  return env;
}

function applyClaudeModelMenuEnv(env: NodeJS.ProcessEnv, selectedAlias: string): void {
  const selected = resolveClaudeModel(selectedAlias);
  const defaultModel = CLAUDE_SUPPORTED_MODELS[0] ?? selected;
  const secondaryModel = CLAUDE_SUPPORTED_MODELS.find((model) => model.alias !== defaultModel.alias) ?? selected;

  setTierModelEnv(env, "OPUS", defaultModel);
  setTierModelEnv(env, "SONNET", secondaryModel);
  setTierModelEnv(env, "HAIKU", CLAUDE_HAIKU_MODEL_SELECTION);

  // Claude Code currently exposes a single generic custom-model slot in
  // addition to the three tier slots. Point that at the selected backend so a
  // `--main together-kimi-k2-7-code` launch also marks Kimi as the custom row.
  env.ANTHROPIC_CUSTOM_MODEL_OPTION = selected.alias;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = selected.definition.name;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Local Anthropic-to-Together proxy";
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES = CLAUDE_MODEL_CAPABILITIES;
}

function setTierModelEnv(env: NodeJS.ProcessEnv, tier: "OPUS" | "SONNET" | "HAIKU", model: ClaudeModelSelection): void {
  const prefix = `ANTHROPIC_DEFAULT_${tier}_MODEL`;
  env[prefix] = model.alias;
  env[`${prefix}_NAME`] = model.definition.name;
  env[`${prefix}_DESCRIPTION`] = `Together AI (${model.definition.name}) via togetherlink — not Anthropic`;
}

export async function runClaudeTogether(options: ClaudeLaunchOptions): Promise<ClaudeLaunchResult> {
  const selectedModel = resolveClaudeModel(options.modelId);
  const modelId = selectedModel.alias;
  const targetModelId = selectedModel.definition.id;
  const modelName = selectedModel.definition.name;
  const debug = process.env.TOGETHERLINK_DEBUG === "1";
  const sessionId = randomLocalProxyToken();
  const authToken = await localProxyAuthToken();

  // Ensure the shared daemon is up (spawn-once/reuse by healthz probe). The
  // daemon outlives this launcher, so N `togetherlink claude` sessions share one
  // proxy process instead of each running its own in-process proxy.
  const { url: proxyUrl } = await ensureDaemon();
  const agentProxyUrl = daemonSessionUrl(proxyUrl, sessionId);

  // Register this session: the daemon builds a per-session CostTracker keyed by
  // our auth token. Sessions bring their own apiKey + model, so the daemon needs
  // no daemon-wide credentials. A failure here means claude's first /v1/messages
  // would get an opaque 401, so surface the registration error explicitly on
  // stderr instead of letting the user chase a phantom "bad key" error.
  const registration = {
    token: sessionId,
    authToken,
    agent: "claude" as const,
    apiKey: options.apiKey,
    modelLabel: modelName,
    modelId,
    targetModelId,
    modelName,
    modelDefinition: selectedModel.definition,
    ...(debug ? { debug: true } : {}),
  };
  try {
    await registerDaemonSession(proxyUrl, registration);
  } catch (err) {
    throw new Error(`Could not register this Claude session with the togetherlink daemon: ${err instanceof Error ? err.message : String(err)}`);
  }

  const telemetrySessionId = randomSessionId();
  const startedAt = Date.now();
  void sendTelemetryEvent({
    event: "session_started",
    sessionId: telemetrySessionId,
    agent: "claude",
    initialModel: targetModelId,
    startedAt,
  });

  // Always-on banner so the user can never be in doubt that this is routing
  // to Together AI, not Anthropic — the model picker alone isn't
  // enough since most users never open it. Goes to stderr so it never
  // corrupts claude's stdout (which pipelines/headless mode depend on).
  process.stderr.write(`togetherlink ▸ Routing Claude Code → Together AI (${modelName}). Not Anthropic.\n`);
  if (debug) {
    process.stderr.write(`[togetherlink proxy] daemon: ${proxyUrl}\n`);
    process.stderr.write(`[togetherlink proxy] session: ${agentProxyUrl}\n`);
    process.stderr.write(`[togetherlink claude] custom model: ${modelId}\n`);
  }

  const child = spawn(
    "claude",
    [
      ...claudeArgsWithoutModelOverrides(options.args ?? []),
      ...claudeCacheFriendlyArgs(options.args ?? []),
      ...claudeExtraSettingsArgs(options.args ?? []),
    ],
    {
      env: buildClaudeEnv({ ...options, modelId, modelName, proxyUrl: agentProxyUrl, authToken }),
      stdio: "inherit",
    },
  );

  // Tell the daemon which pid this session's claude child runs as, so it can
  // reap the session if this launcher is killed (kill -9) before it can
  // deregister. Best-effort: if this fails, the reaper just can't auto-clean —
  // the normal exit path still deregisters explicitly below.
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
    label: "Claude session",
  });

  // Await the child, but capture the result even on a spawn error so the cost
  // line + deregister always run (the old code guaranteed these in a finally
  // block). On child.on("error") we treat it as a non-zero exit rather than
  // rejecting past the cleanup below.
  const result: ClaudeLaunchResult = await new Promise<ClaudeLaunchResult>((resolve) => {
    child.on("error", (err) => {
      process.stderr.write(`togetherlink ▸ Failed to launch claude: ${err.message}.\n`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });

  // Print the real Together model cost at shutdown — Claude Code's own /usage
  // estimate can't price a non-Anthropic model, so this is the accurate source.
  // The daemon owns the tracker (keyed by our token); fetch its summary. Goes to
  // stderr so it never corrupts claude's stdout. Best-effort: a dead/unreachable
  // daemon (or a timeout) just means no cost line, never a broken command.
  const usage = await printSessionCost(proxyUrl, sessionId);
  keepalive.stop();
  // Deregister so the daemon doesn't keep a finished session's tracker around.
  // (A kill -9 of this launcher skips this; the daemon reaps orphaned sessions
  // on a timer — see daemon/state.ts.)
  try {
    await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  } catch {
    // best-effort
  }

  const endedAt = Date.now();
  void sendTelemetryEvent({
    event: "session_ended",
    sessionId: telemetrySessionId,
    agent: "claude",
    initialModel: targetModelId,
    finalModel: targetModelId,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    ...(usage ? { usage } : {}),
    ...(typeof result.status === "number" ? { exitCode: result.status } : {}),
    ...(result.signal ? { signal: result.signal } : {}),
  });

  return result;
}

async function printSessionCost(proxyUrl: string, authToken: string): Promise<{ promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number } | undefined> {
  try {
    const response = await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}/cost`);
    if (response.ok) {
      const { summary, totals } = (await response.json()) as {
        summary?: string;
        totals?: { promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number };
      };
      if (summary) {
        process.stderr.write(`${summary}\n`);
      }
      return totals;
    }
  } catch {
    // Daemon gone, unreachable, or timed out: skip the cost line rather than
    // fail the command (or hang it — daemonFetch bounds the wait).
  }
  return undefined;
}

function randomLocalProxyToken(): string {
  return `togetherlink-${randomBytes(24).toString("base64url")}`;
}

function claudeArgsWithoutModelOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--model" || arg === "-m") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

function claudeCacheFriendlyArgs(args: string[]): string[] {
  for (const arg of args) {
    if (
      arg === "--exclude-dynamic-system-prompt-sections" ||
      arg === "--system-prompt" ||
      arg.startsWith("--system-prompt=") ||
      arg === "--system-prompt-file" ||
      arg.startsWith("--system-prompt-file=")
    ) {
      return [];
    }
  }
  return ["--exclude-dynamic-system-prompt-sections"];
}

// Extra settings.json keys togetherlink applies by default. These are
// settings-only (no env-var equivalent), so they're injected via claude's
// `--settings <json>` flag, which *merges* into the user's existing settings
// rather than replacing them. We bail out entirely if the user already passed
// `--settings` themselves, so we never clobber their explicit config.
function claudeExtraSettingsArgs(args: string[]): string[] {
  for (const arg of args) {
    if (arg === "--settings" || arg.startsWith("--settings=")) {
      return [];
    }
  }

  // skipWebFetchPreflight: the WebFetch tool pings api.anthropic.com directly
  // (bypassing ANTHROPIC_BASE_URL / our proxy) for its domain safety check. In
  // a togetherlink session api.anthropic.com isn't our model endpoint, so the
  // preflight fails and WebFetch breaks entirely. Skipping it restores
  // WebFetch without reaching Anthropic. Only sends a boolean — no other
  // settings keys are added here.
  return ["--settings", JSON.stringify({ skipWebFetchPreflight: true })];
}
