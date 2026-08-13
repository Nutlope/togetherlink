import { resolveCodexModel } from "../codex/defaults.js";
import {
  buildDeepseekLaunchSpec,
  resolveDeepseekPatchPath,
  writeDeepseekPatch,
} from "../deepseek/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import { resolveTogetherApiKey, resolveTogetherBaseUrl } from "../together-core.js";

export default defineHarness({
  id: HARNESS.DEEPSEEK,
  label: "DeepSeek Harness (alpha)",

  async run(ctx) {
    const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveCodexModel(ctx.main);
    const baseUrl = resolveTogetherBaseUrl();
    const nativeDeepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const patchPath = resolveDeepseekPatchPath(ctx.home, selectedModel, baseUrl, process.env);
    await writeDeepseekPatch(patchPath, selectedModel, baseUrl, nativeDeepseekApiKey);
    const launch = buildDeepseekLaunchSpec({
      apiKey,
      baseUrl,
      patchPath,
      passthrough: ctx.passthrough ?? [],
    });

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink deepseek] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink deepseek] patch: ${patchPath}\n`);
    }

    process.stderr.write(
      "togetherlink ▸ Launching DeepSeek Harness web UI with Together AI (alpha).\n",
    );
    const result = await runTrackedSpawnedSession({
      agent: HARNESS.DEEPSEEK,
      modelId: selectedModel.id,
      binary: launch.binary,
      args: launch.args,
      options: { env: launch.env, stdio: "inherit" },
      home: ctx.home,
    });

    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
