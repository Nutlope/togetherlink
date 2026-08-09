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

const OMP_PROVIDER_ID = "together";
const OMP_SUPPORTED_MODELS = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(",");

const VALUE_FLAGS = new Set(["--api-key", "--provider", "--model", "--models"]);

function ompArgsWithoutTogetherlinkOverrides(args: string[]): string[] {
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

export function buildOmpModelsJson(apiKey: string, baseUrl = TOGETHER_BASE_URL): string {
  const models = CODEX_SUPPORTED_MODELS.map(({ definition }) => ({
    id: definition.id,
    name: definition.name,
    reasoning: definition.reasoning,
    input: definition.modalities.input.filter(
      (modality): modality is "text" | "image" => modality === "text" || modality === "image",
    ),
    supportsTools: definition.tool_call,
    contextWindow: definition.limit.context,
    maxTokens: definition.limit.output,
    cost: {
      input: definition.cost.input,
      output: definition.cost.output,
      cacheRead: definition.cost.cache_read,
      cacheWrite: 0,
    },
  }));

  return `${JSON.stringify(
    {
      providers: {
        [OMP_PROVIDER_ID]: {
          api: "openai-completions",
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

function writeOmpModelsJson(agentDir: string, apiKey: string, baseUrl: string): void {
  // Current omp migrates this legacy-compatible JSON file to models.yml. The
  // agent directory is throwaway, so supporting old and new omp releases costs
  // us no persistent migration or user-config mutation.
  writeFileSync(join(agentDir, "models.json"), buildOmpModelsJson(apiKey, baseUrl), "utf8");
}

export default defineHarness({
  id: HARNESS.OMP,
  label: "Oh My Pi",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const agentDir = mkdtempSync(join(tmpdir(), "togetherlink-omp-"));
    const sessionDir = join(ctx.home || homedir(), ".omp", "agent", "sessions");
    const baseUrl = resolveTogetherBaseUrl();
    writeOmpModelsJson(agentDir, apiKey, baseUrl);
    const selectedModel = resolveCodexModel(ctx.main);
    const args = [
      "--provider",
      OMP_PROVIDER_ID,
      "--model",
      selectedModel.id,
      "--models",
      OMP_SUPPORTED_MODELS,
      "--api-key",
      apiKey,
      "--session-dir",
      sessionDir,
      "--auto-approve",
      ...ompArgsWithoutTogetherlinkOverrides(ctx.passthrough ?? []),
    ];

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink omp] provider: ${OMP_PROVIDER_ID}\n`);
      process.stderr.write(`[togetherlink omp] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink omp] models: ${OMP_SUPPORTED_MODELS}\n`);
      process.stderr.write(`[togetherlink omp] temp config dir: ${agentDir}\n`);
      process.stderr.write(`[togetherlink omp] session dir: ${sessionDir}\n`);
    }

    process.stderr.write(`togetherlink ▸ Launching Oh My Pi with Together AI.\n`);
    const result = await runTrackedSpawnedSession({
      agent: HARNESS.OMP,
      modelId: selectedModel.id,
      binary: "omp",
      args,
      options: {
        env: {
          ...process.env,
          OMP_SKIP_SETUP: "1",
          PI_CODING_AGENT_DIR: agentDir,
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
