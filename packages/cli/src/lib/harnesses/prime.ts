import { CODEX_SUPPORTED_MODELS } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import {
  buildPrimeLaunchSpec,
  PRIME_PROVIDER_ID,
  resolvePrimeProviderExtensionPath,
  writePrimeProviderExtension,
} from "../prime/core.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";

export default defineHarness({
  id: HARNESS.PRIME,
  label: "Prime Agent",

  async run(ctx) {
    const selectedModel = {
      id: ctx.selectedModel.definition.id,
      definition: ctx.selectedModel.definition,
    };
    const baseUrl = ctx.baseUrl;
    const models = [...CODEX_SUPPORTED_MODELS];
    if (!models.some((model) => model.id === selectedModel.id)) models.push(selectedModel);
    const extensionPath = resolvePrimeProviderExtensionPath(ctx.home, baseUrl, process.env, models);
    await writePrimeProviderExtension(extensionPath, baseUrl, models);
    const launch = buildPrimeLaunchSpec({
      selectedModel,
      apiKey: ctx.apiKey,
      baseUrl,
      extensionPath,
      passthrough: ctx.passthrough ?? [],
      models,
    });

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink prime] provider: ${PRIME_PROVIDER_ID}\n`);
      process.stderr.write(`[togetherlink prime] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink prime] provider extension: ${extensionPath}\n`);
    }

    process.stderr.write(`togetherlink ▸ Launching Prime Agent with Together AI.\n`);
    const result = await runTrackedSpawnedSession({
      agent: HARNESS.PRIME,
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
