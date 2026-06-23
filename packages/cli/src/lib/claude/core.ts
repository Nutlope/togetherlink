import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  CLAUDE_MODEL_CAPABILITIES,
  CLAUDE_SUPPORTED_MODELS,
  resolveClaudeModel,
  type ClaudeModelSelection,
} from "./defaults.js";
import { startClaudeProxy } from "./proxy.js";

const CONFLICTING_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
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
  setTierModelEnv(env, "HAIKU", defaultModel);

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
  const authToken = randomLocalProxyToken();
  const proxy = await startClaudeProxy({
    apiKey: options.apiKey,
    modelId,
    targetModelId,
    modelName,
    modelDefinition: selectedModel.definition,
    authToken,
    debug: process.env.TOGETHERLINK_DEBUG === "1",
  });

  try {
    // Always-on banner so the user can never be in doubt that this is routing
    // to Together AI, not Anthropic — the model picker alone isn't
    // enough since most users never open it. Goes to stderr so it never
    // corrupts claude's stdout (which pipelines/headless mode depend on).
    process.stderr.write(
      `togetherlink ▸ Routing Claude Code → Together AI (${modelName}). Not Anthropic.\n`,
    );
    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink proxy] listening: ${proxy.url}\n`);
      process.stderr.write(`[togetherlink claude] custom model: ${modelId}\n`);
    }
    const child = spawn(
      "claude",
      [...claudeArgsWithoutModelOverrides(options.args ?? []), ...claudeExtraSettingsArgs(options.args ?? [])],
      {
        env: buildClaudeEnv({ ...options, modelId, modelName, proxyUrl: proxy.url, authToken }),
        stdio: "inherit",
      },
    );

    return await new Promise<ClaudeLaunchResult>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (status, signal) => resolve({ status, signal }));
    });
  } finally {
    // Always print the real Together model cost at shutdown — Claude Code's own
    // /usage estimate can't price a non-Anthropic model, so this is the
    // accurate source. Goes to stderr so it never corrupts claude's stdout.
    process.stderr.write(`${proxy.costSummary()}\n`);
    await proxy.close();
  }
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
