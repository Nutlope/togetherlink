import {
  buildDeepseekLaunchSpec,
  resolveDeepseekPatchPath,
  writeDeepseekPatch,
} from "../deepseek/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import { CODEX_SUPPORTED_MODELS } from "../codex/defaults.js";

export default defineHarness({
  id: HARNESS.DEEPSEEK,
  label: "DeepSeek Harness (alpha)",

  async run(ctx) {
    const selectedModel = {
      id: ctx.selectedModel.definition.id,
      definition: ctx.selectedModel.definition,
    };
    const baseUrl = ctx.baseUrl;
    const models = [...CODEX_SUPPORTED_MODELS];
    if (!models.some((model) => model.id === selectedModel.id)) models.push(selectedModel);
    const nativeDeepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const patchPath = resolveDeepseekPatchPath(
      ctx.home,
      selectedModel,
      baseUrl,
      process.env,
      models,
    );
    await writeDeepseekPatch(patchPath, selectedModel, baseUrl, nativeDeepseekApiKey, models);
    const launch = buildDeepseekLaunchSpec({
      apiKey: ctx.apiKey,
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
