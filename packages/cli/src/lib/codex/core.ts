import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { CODEX_AUTH_ENV, CODEX_PROVIDER_ID, resolveCodexModel } from "./defaults.js";
import { ensureDaemon, daemonFetch } from "../daemon/launch.js";

export type CodexLaunchOptions = {
  apiKey: string;
  modelId?: string;
  args?: string[];
};

export type CodexLaunchResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
};

const MODEL_OVERRIDE_FLAGS = new Set(["--model", "-m"]);

export async function runCodexTogether(options: CodexLaunchOptions): Promise<CodexLaunchResult> {
  const selectedModel = resolveCodexModel(options.modelId);
  const modelId = selectedModel.definition.id;
  const modelName = selectedModel.definition.name;
  const debug = process.env.TOGETHERLINK_DEBUG === "1";
  const authToken = randomLocalProxyToken();
  const { url: proxyUrl } = await ensureDaemon();

  try {
    const response = await daemonFetch(`${proxyUrl}/internal/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: authToken,
        agent: "codex",
        apiKey: options.apiKey,
        modelLabel: modelName,
        modelId,
        targetModelId: modelId,
        modelName,
        modelDefinition: selectedModel.definition,
        ...(debug ? { debug: true } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`daemon registration failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }
  } catch (err) {
    throw new Error(`Could not register this Codex session with the togetherlink daemon: ${err instanceof Error ? err.message : String(err)}`);
  }

  process.stderr.write(`togetherlink ▸ Routing Codex → Together AI (${modelName}). Not OpenAI.\n`);
  if (debug) {
    process.stderr.write(`[togetherlink proxy] daemon: ${proxyUrl}\n`);
    process.stderr.write(`[togetherlink codex] model: ${modelId}\n`);
  }

  const child = spawn("codex", [...codexConfigArgs(proxyUrl, authToken, modelId), ...codexArgsWithoutModelOverrides(options.args ?? [])], {
    env: buildCodexEnv(authToken),
    stdio: "inherit",
  });

  if (typeof child.pid === "number") {
    try {
      await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}/pid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pid: child.pid }),
      });
    } catch {
      // best-effort
    }
  }

  const result = await new Promise<CodexLaunchResult>((resolve) => {
    child.on("error", (err) => {
      process.stderr.write(`togetherlink ▸ Failed to launch codex: ${err.message}.\n`);
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (status, signal) => resolve({ status, signal }));
  });

  await printSessionCost(proxyUrl, authToken);
  try {
    await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}`, { method: "DELETE" });
  } catch {
    // best-effort
  }

  return result;
}

function buildCodexEnv(authToken: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [CODEX_AUTH_ENV]: authToken,
  };
}

function codexConfigArgs(proxyUrl: string, authToken: string, modelId: string): string[] {
  void authToken;
  return [
    "-c",
    `model_provider="${CODEX_PROVIDER_ID}"`,
    "-c",
    `model="${modelId}"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.name="Togetherlink"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.base_url="${proxyUrl}/v1"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.wire_api="responses"`,
    "-c",
    `model_providers.${CODEX_PROVIDER_ID}.env_key="${CODEX_AUTH_ENV}"`,
  ];
}

function codexArgsWithoutModelOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (MODEL_OVERRIDE_FLAGS.has(arg)) {
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

async function printSessionCost(proxyUrl: string, authToken: string): Promise<void> {
  try {
    const response = await daemonFetch(`${proxyUrl}/internal/sessions/${encodeURIComponent(authToken)}/cost`);
    if (response.ok) {
      const { summary } = (await response.json()) as { summary?: string };
      if (summary) {
        process.stderr.write(`${summary}\n`);
      }
    }
  } catch {
    // best-effort
  }
}

function randomLocalProxyToken(): string {
  return `togetherlink-${randomBytes(24).toString("base64url")}`;
}
