import { spawn } from "node:child_process";
import { CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_MODEL_NAME, CLAUDE_MODEL_CAPABILITIES } from "./defaults.js";
import { startClaudeProxy } from "./proxy.js";

const CONFLICTING_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
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
  modelId = CLAUDE_DEFAULT_MODEL,
  proxyUrl,
}: ClaudeLaunchOptions & { proxyUrl: string }): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of CONFLICTING_ENV_KEYS) {
    delete env[key];
  }
  env.ANTHROPIC_BASE_URL = proxyUrl;
  env.ANTHROPIC_AUTH_TOKEN = "togetherlink-local-proxy";
  env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1";
  env.ANTHROPIC_MODEL = modelId;
  env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelId;
  env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelId;
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelId;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION = modelId;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME =
    modelId === CLAUDE_DEFAULT_MODEL ? CLAUDE_DEFAULT_MODEL_NAME : `Together ${modelId}`;
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Local Anthropic-to-Together proxy";
  env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES = CLAUDE_MODEL_CAPABILITIES;

  // Label each tier row so the model picker is unambiguous: these point at
  // Together AI's GLM-5.2 via the local proxy — NOT Anthropic Claude. Without
  // these, Claude Code falls back to its hardcoded claude-opus/sonnet/haiku ids
  // and shows misleading "Claude …" names, or a bare id with a generic "Custom
  // Opus model" label. Setting the same id across all three tiers is correct:
  // the proxy forces GLM-5.2 regardless of which tier a call is routed as, so
  // the labels are honest about what actually runs.
  const displayName = env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME;
  const notAnthropicDescription = "Together AI (GLM-5.2) via togetherlink — not Anthropic";
  env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = displayName;
  env.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION = notAnthropicDescription;
  env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME = displayName;
  env.ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION = notAnthropicDescription;
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME = displayName;
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION = notAnthropicDescription;

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

export async function runClaudeTogether(options: ClaudeLaunchOptions): Promise<ClaudeLaunchResult> {
  const modelId = options.modelId ?? CLAUDE_DEFAULT_MODEL;
  const proxy = await startClaudeProxy({
    apiKey: options.apiKey,
    modelId,
    debug: process.env.TOGETHERLINK_DEBUG === "1",
  });

  try {
    // Always-on banner so the user can never be in doubt that this is routing
    // to Together AI (GLM-5.2), not Anthropic — the model picker alone isn't
    // enough since most users never open it. Goes to stderr so it never
    // corrupts claude's stdout (which pipelines/headless mode depend on).
    process.stderr.write(
      `togetherlink ▸ Routing Claude Code → Together AI (GLM-5.2). Not Anthropic.\n`,
    );
    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink proxy] listening: ${proxy.url}\n`);
      process.stderr.write(`[togetherlink claude] custom model: ${modelId}\n`);
    }
    const child = spawn(
      "claude",
      [...claudeArgsWithoutModelOverrides(options.args ?? []), ...claudeExtraSettingsArgs(options.args ?? [])],
      {
      env: buildClaudeEnv({ ...options, proxyUrl: proxy.url }),
      stdio: "inherit",
    });

    return await new Promise<ClaudeLaunchResult>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (status, signal) => resolve({ status, signal }));
    });
  } finally {
    // Always print the real GLM-5.2 cost at shutdown — Claude Code's own
    // /usage estimate can't price a non-Anthropic model, so this is the
    // accurate source. Goes to stderr so it never corrupts claude's stdout.
    process.stderr.write(`${proxy.costSummary()}\n`);
    await proxy.close();
  }
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
