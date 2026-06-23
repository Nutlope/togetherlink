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
    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink proxy] listening: ${proxy.url}\n`);
      process.stderr.write(`[togetherlink claude] custom model: ${modelId}\n`);
    }
    const child = spawn("claude", claudeArgsWithoutModelOverrides(options.args ?? []), {
      env: buildClaudeEnv({ ...options, proxyUrl: proxy.url }),
      stdio: "inherit",
    });

    return await new Promise<ClaudeLaunchResult>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (status, signal) => resolve({ status, signal }));
    });
  } finally {
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
