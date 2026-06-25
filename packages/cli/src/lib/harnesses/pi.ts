import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CODEX_DEFAULT_MODEL, CODEX_SUPPORTED_MODELS, resolveCodexModel } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext, type HarnessResult } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";

const PI_PROVIDER_ID = "together";
const PI_SUPPORTED_MODELS = CODEX_SUPPORTED_MODELS.map((model) => model.id).join(",");

const VALUE_FLAGS = new Set([
  "--api-key",
  "--provider",
  "--model",
  "--models",
  "--session",
  "--session-id",
  "--session-dir",
  "--fork",
]);

const BOOLEAN_FLAGS = new Set([
  "--continue",
  "-c",
  "--resume",
  "-r",
  "--no-session",
]);

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
      arg.startsWith("--models=") ||
      arg.startsWith("--session=") ||
      arg.startsWith("--session-id=") ||
      arg.startsWith("--session-dir=") ||
      arg.startsWith("--fork=")
    ) {
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

function writePiModelsJson(agentDir: string, apiKey: string): void {
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

  writeFileSync(
    join(agentDir, "models.json"),
    `${JSON.stringify({
      providers: {
        [PI_PROVIDER_ID]: {
          apiKey,
          models,
        },
      },
    }, null, 2)}\n`,
    "utf8",
  );
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
    writePiModelsJson(agentDir, apiKey);
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
      "--no-session",
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
      process.stderr.write(`[togetherlink pi] agent dir: ${agentDir}\n`);
    }

    process.stderr.write(`togetherlink ▸ Launching Pi Code with Together AI.\n`);
    const child = spawn("pi", args, {
      env: {
        ...process.env,
        PI_CODING_AGENT_DIR: agentDir,
        TOGETHER_API_KEY: apiKey,
      },
      stdio: "inherit",
    });

    const result = await new Promise<{ status: number | null; signal: NodeJS.Signals | null }>(
      (resolve) => {
        child.on("error", (err) => {
          process.stderr.write(`togetherlink ▸ Failed to launch pi: ${err.message}.\n`);
          resolve({ status: 1, signal: null });
        });
        child.on("exit", (status, signal) => resolve({ status, signal }));
      },
    );

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

  async status(): Promise<HarnessResult> {
    return {
      payload: {
        harness: HARNESS.PI,
        provider: PI_PROVIDER_ID,
        currentModel: CODEX_DEFAULT_MODEL,
        targetModel: CODEX_DEFAULT_MODEL,
        supportedModels: PI_SUPPORTED_MODELS,
        sessionMode: "ephemeral",
      },
    };
  },
});
