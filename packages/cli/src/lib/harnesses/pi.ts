import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { CODEX_SUPPORTED_MODELS, resolveCodexModel } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext, type HarnessResult } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import {
  resolveTogetherApiKey,
  resolveTogetherBaseUrl,
  TOGETHER_BASE_URL,
} from "../together-core.js";

const PI_PROVIDER_ID = "together";
const PI_SUPPORTED_MODELS = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(",");

const VALUE_FLAGS = new Set(["--api-key", "--provider", "--model", "--models"]);

function piArgsWithoutTogetherlinkOverrides(args: string[]): string[] {
  const sanitized: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      i += 1;
      continue;
    }
    if (
      arg.startsWith("--api-key=") ||
      arg.startsWith("--provider=") ||
      arg.startsWith("--model=") ||
      arg.startsWith("--models=")
    ) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

export function buildPiModelsJson(apiKey: string, baseUrl = TOGETHER_BASE_URL): string {
  const models = CODEX_SUPPORTED_MODELS.map(({ definition }) => ({
    id: definition.id,
    name: definition.name,
    reasoning: definition.reasoning,
    input: definition.modalities.input,
    contextWindow: definition.limit.context,
    maxTokens: definition.limit.output,
    cost: {
      input: definition.cost.input,
      output: definition.cost.output,
      cacheRead: definition.cost.cache_read ?? 0,
      cacheWrite: 0,
    },
  }));

  return `${JSON.stringify(
    {
      providers: {
        [PI_PROVIDER_ID]: {
          apiKey,
          baseUrl,
          models,
        },
      },
    },
    null,
    2,
  )}\n`;
}

function writePiModelsJson(agentDir: string, apiKey: string, baseUrl: string): void {
  writeFileSync(join(agentDir, "models.json"), buildPiModelsJson(apiKey, baseUrl), "utf8");
}

export default defineHarness({
  id: HARNESS.PI,
  label: "Pi Code",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const agentDir = mkdtempSync(join(tmpdir(), "togetherlink-pi-"));
    const sessionDir =
      process.env.PI_CODING_AGENT_SESSION_DIR ??
      join(ctx.home || homedir(), ".pi", "agent", "sessions");
    const baseUrl = resolveTogetherBaseUrl();
    writePiModelsJson(agentDir, apiKey, baseUrl);
    const selectedModel = resolveCodexModel(ctx.main);
    const args = [
      "--provider",
      PI_PROVIDER_ID,
      "--model",
      selectedModel.id,
      "--models",
      PI_SUPPORTED_MODELS,
      "--api-key",
      apiKey,
      "--no-approve",
      "--no-extensions",
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      ...piArgsWithoutTogetherlinkOverrides(ctx.passthrough ?? []),
    ];

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink pi] provider: ${PI_PROVIDER_ID}\n`);
      process.stderr.write(`[togetherlink pi] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink pi] models: ${PI_SUPPORTED_MODELS}\n`);
      process.stderr.write(`[togetherlink pi] temp config dir: ${agentDir}\n`);
      process.stderr.write(`[togetherlink pi] session dir: ${sessionDir}\n`);
    }

    process.stderr.write(`togetherlink ▸ Launching Pi Code with Together AI.\n`);
    const result = await runTrackedSpawnedSession({
      agent: HARNESS.PI,
      modelId: selectedModel.id,
      binary: "pi",
      args,
      options: {
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: agentDir,
          PI_CODING_AGENT_SESSION_DIR: sessionDir,
          TOGETHER_API_KEY: apiKey,
        },
        stdio: "inherit",
      },
      home: ctx.home,
    });

    try {
      rmSync(agentDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }

    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
