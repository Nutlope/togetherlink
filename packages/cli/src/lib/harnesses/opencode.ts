import { spawn } from "node:child_process";
import { OPENCODE_DEFAULT_MODEL, OPENCODE_DEFAULT_MODEL_NAME } from "../opencode/defaults.js";
import { buildOpencodeConfigJson, buildOpencodeEnv } from "../opencode/core.js";
import { resolveTogetherApiKey } from "../together-core.js";
import { defineHarness } from "../harness-types.js";
import { HARNESS } from "../harness.js";
import type { HarnessContext, HarnessResult } from "../harness-types.js";

/**
 * Strips any `--model`/`-m`/`--model=` from passthrough args so a user can't
 * override the Together default. Parallel to Claude's
 * `claudeArgsWithoutModelOverrides`.
 */
function opencodeArgsWithoutModelOverrides(args: string[]): string[] {
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

export default defineHarness({
  id: HARNESS.OPENCODE,
  label: "OpenCode",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const modelId = ctx.main ?? OPENCODE_DEFAULT_MODEL;
    const configJson = buildOpencodeConfigJson({ modelId });
    const env = buildOpencodeEnv({ apiKey, configJson });

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink opencode] custom model: ${modelId}\n`);
      process.stderr.write(`[togetherlink opencode] config: ${JSON.stringify(configJson)}\n`);
    }

    const child = spawn("opencode", opencodeArgsWithoutModelOverrides(ctx.passthrough ?? []), {
      env,
      stdio: "inherit",
    });

    const result = await new Promise<{ status: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (status, signal) => resolve({ status, signal }));
      },
    );

    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },

  async status(): Promise<HarnessResult> {
    return {
      payload: {
        harness: HARNESS.OPENCODE,
        provider: "together",
        currentModel: OPENCODE_DEFAULT_MODEL,
        targetModel: OPENCODE_DEFAULT_MODEL,
        modelName: OPENCODE_DEFAULT_MODEL_NAME,
      },
    };
  },
});