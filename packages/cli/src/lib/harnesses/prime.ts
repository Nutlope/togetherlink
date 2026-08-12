import { resolveCodexModel } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import {
  buildPrimeLaunchSpec,
  PRIME_PROVIDER_ID,
  resolvePrimeProviderExtensionPath,
  writePrimeProviderExtension,
} from "../prime/core.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import { resolveTogetherApiKey, resolveTogetherBaseUrl } from "../together-core.js";

export default defineHarness({
  id: HARNESS.PRIME,
  label: "Prime Agent",

  async run(ctx) {
    const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveCodexModel(ctx.main);
    const baseUrl = resolveTogetherBaseUrl();
    const extensionPath = resolvePrimeProviderExtensionPath(ctx.home);
    await writePrimeProviderExtension(extensionPath, baseUrl);
    const launch = buildPrimeLaunchSpec({
      selectedModel,
      apiKey,
      baseUrl,
      extensionPath,
      passthrough: ctx.passthrough ?? [],
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
