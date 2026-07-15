import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCodexModel } from "../codex/defaults.js";
import {
  GROK_API_KEY_ENV,
  GROK_VISION_MODEL_ALIAS,
  grokArgsWithoutTogetherlinkOverrides,
  grokModelAlias,
  populateTemporaryGrokHome,
} from "../grok/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext, type HarnessResult } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";

export default defineHarness({
  id: HARNESS.GROK,
  label: "Grok Build",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveCodexModel(ctx.main);
    const selectedAlias = grokModelAlias(selectedModel.definition);
    const temporaryHome = mkdtempSync(join(tmpdir(), "togetherlink-grok-"));
    const configuredGrokHome = process.env.GROK_HOME?.trim();
    const persistentHome = configuredGrokHome || join(ctx.home || homedir(), ".grok");
    populateTemporaryGrokHome({
      temporaryHome,
      persistentHome,
      selectedModel: selectedModel.definition,
    });

    const args = [
      "--model",
      selectedAlias,
      ...grokArgsWithoutTogetherlinkOverrides(ctx.passthrough ?? []),
    ];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GROK_HOME: temporaryHome,
      [GROK_API_KEY_ENV]: apiKey,
      GROK_DEFAULT_MODEL: selectedAlias,
      GROK_WEB_SEARCH_MODEL: selectedAlias,
      GROK_SESSION_SUMMARY_MODEL: selectedAlias,
      GROK_IMAGE_DESCRIPTION_MODEL: GROK_VISION_MODEL_ALIAS,
      GROK_PROMPT_SUGGESTIONS_MODEL: selectedAlias,
      GROK_TELEMETRY_ENABLED: "0",
      GROK_FEEDBACK_ENABLED: "0",
    };

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink grok] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink grok] temporary home: ${temporaryHome}\n`);
      process.stderr.write(`[togetherlink grok] persistent state: ${persistentHome}\n`);
    }

    process.stderr.write("togetherlink ▸ Launching Grok Build with Together AI.\n");
    try {
      const child = spawn("grok", args, { env, stdio: "inherit" });
      const result = await new Promise<{ status: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          child.on("error", (error) => {
            process.stderr.write(`togetherlink ▸ Failed to launch grok: ${error.message}.\n`);
            resolve({ status: 1, signal: null });
          });
          child.on("exit", (status, signal) => resolve({ status, signal }));
        },
      );
      process.exitCode = typeof result.status === "number" ? result.status : result.signal ? 1 : 0;
    } finally {
      rmSync(temporaryHome, { recursive: true, force: true });
    }

    return {};
  },
});
