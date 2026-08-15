import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { CODEX_SUPPORTED_MODELS, type CodexModelSelection } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessRunContext, type HarnessResult } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import { TOGETHER_BASE_URL } from "../together-core.js";

const PI_PROVIDER_ID = "together";
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

export function buildPiModelsJson(
  baseUrl = TOGETHER_BASE_URL,
  modelSelections: readonly CodexModelSelection[] = CODEX_SUPPORTED_MODELS,
): string {
  const models = modelSelections.map(({ definition }) => ({
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
          baseUrl,
          models,
        },
      },
    },
    null,
    2,
  )}\n`;
}

function writePiModelsJson(
  agentDir: string,
  baseUrl: string,
  models: readonly CodexModelSelection[],
): void {
  writeFileSync(join(agentDir, "models.json"), buildPiModelsJson(baseUrl, models), "utf8");
}

// Pi resolves its managed tools (fd, rg) from "<agent dir>/bin". togetherlink
// points PI_CODING_AGENT_DIR at a fresh temp dir per launch, so without seeding,
// Pi would re-download fd on every run. Reuse the user's real ~/.pi/agent/bin
// in both directions: copy existing tools into the temp dir before launch, and
// persist anything Pi downloaded back to the real bin dir afterwards.
const PI_MANAGED_TOOLS = ["fd", "fd.exe", "rg", "rg.exe"];

export function seedPiManagedTools(agentDir: string, userBinDir: string): void {
  if (!existsSync(userBinDir)) {
    return;
  }
  const targetDir = join(agentDir, "bin");
  for (const tool of PI_MANAGED_TOOLS) {
    const source = join(userBinDir, tool);
    if (!existsSync(source)) {
      continue;
    }
    mkdirSync(targetDir, { recursive: true });
    try {
      copyFileSync(source, join(targetDir, tool));
    } catch {
      // best-effort; Pi falls back to downloading the tool
    }
  }
}

export function persistPiManagedTools(agentDir: string, userBinDir: string): void {
  const tempBinDir = join(agentDir, "bin");
  if (!existsSync(tempBinDir)) {
    return;
  }
  let entries: string[];
  try {
    entries = readdirSync(tempBinDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!PI_MANAGED_TOOLS.includes(entry)) {
      continue;
    }
    const target = join(userBinDir, entry);
    if (existsSync(target)) {
      continue;
    }
    try {
      mkdirSync(userBinDir, { recursive: true });
      copyFileSync(join(tempBinDir, entry), target);
    } catch {
      // best-effort; the next launch simply re-downloads the tool
    }
  }
}

export default defineHarness({
  id: HARNESS.PI,
  label: "Pi Code",

  async run(ctx: HarnessRunContext): Promise<HarnessResult> {
    const agentDir = mkdtempSync(join(tmpdir(), "togetherlink-pi-"));
    const userHome = ctx.home || homedir();
    const sessionDir =
      process.env.PI_CODING_AGENT_SESSION_DIR ?? join(userHome, ".pi", "agent", "sessions");
    const baseUrl = ctx.baseUrl;
    const selectedModel = {
      id: ctx.selectedModel.definition.id,
      definition: ctx.selectedModel.definition,
    };
    const models = [...CODEX_SUPPORTED_MODELS];
    if (!models.some((model) => model.id === selectedModel.id)) models.push(selectedModel);
    const supportedModels = models.map((model) => model.id).join(",");
    writePiModelsJson(agentDir, baseUrl, models);
    const userBinDir = join(userHome, ".pi", "agent", "bin");
    seedPiManagedTools(agentDir, userBinDir);
    const args = [
      "--provider",
      PI_PROVIDER_ID,
      "--model",
      selectedModel.id,
      "--models",
      supportedModels,
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
      process.stderr.write(`[togetherlink pi] models: ${supportedModels}\n`);
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
          TOGETHER_API_KEY: ctx.apiKey,
        },
        stdio: "inherit",
      },
      home: ctx.home,
    });

    try {
      persistPiManagedTools(agentDir, userBinDir);
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
