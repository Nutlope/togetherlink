import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexModelCatalogJson } from "./catalog.js";
import { CODEX_AUTH_ENV, CODEX_PROVIDER_ID, resolveCodexModel } from "./defaults.js";
import { codexArgsIgnoreUserConfig, ensureCodexGenericUserDefaults } from "./user-config.js";
import {} from "../daemon/launch.js";
import { runProxiedSession, type ProxiedSessionResult } from "../proxied-session.js";

export type CodexLaunchOptions = {
  apiKey: string;
  home: string;
  modelId?: string;
  args?: string[];
};

export type CodexLaunchResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
};

const MODEL_OVERRIDE_FLAGS = new Set(["--model", "-m"]);

export async function runCodexTogether(options: CodexLaunchOptions): Promise<CodexLaunchResult> {
  const args = options.args ?? [];
  if (!codexArgsIgnoreUserConfig(args)) {
    await ensureCodexGenericUserDefaults(options.home);
  }

  const selectedModel = resolveCodexModel(options.modelId);
  let catalog: { path: string; cleanup: () => void } | undefined;
  const result: ProxiedSessionResult = await runProxiedSession({
    agent: "codex",
    apiKey: options.apiKey,
    modelId: selectedModel.definition.id,
    targetModelId: selectedModel.definition.id,
    modelName: selectedModel.definition.name,
    modelDefinition: selectedModel.definition,
    args,
    binary: "codex",
    keepaliveLabel: "Codex session",
    banner: (modelName) =>
      `togetherlink ▸ Routing Codex → Together AI (${modelName}). Not OpenAI.\n`,
    beforeSpawn: () => {
      catalog = writeCodexModelCatalog();
      return catalog;
    },
    buildEnv: ({ authToken }) => buildCodexEnv(authToken),
    buildArgs: ({ proxyUrl, authToken, modelId, beforeSpawnResult }) => [
      ...codexArgsWithoutModelOverrides(args),
      ...codexConfigArgs(
        proxyUrl,
        authToken,
        modelId,
        (beforeSpawnResult as { path: string; cleanup: () => void } | undefined)?.path ?? "",
      ),
    ],
    afterDeregister: () => catalog?.cleanup(),
  });
  return result;
}

function buildCodexEnv(authToken: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [CODEX_AUTH_ENV]: authToken,
  };
}

function codexConfigArgs(
  proxyUrl: string,
  authToken: string,
  modelId: string,
  catalogPath: string,
): string[] {
  void authToken;
  return [
    "-c",
    `model_provider="${CODEX_PROVIDER_ID}"`,
    "-c",
    `model="${modelId}"`,
    "-c",
    `model_catalog_json="${catalogPath}"`,
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

function writeCodexModelCatalog(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "togetherlink-codex-catalog-"));
  const path = join(dir, "models.json");
  writeFileSync(path, codexModelCatalogJson(), "utf8");
  return {
    path,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
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
