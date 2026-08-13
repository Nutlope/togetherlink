import { resolveCodexModel } from "../codex/defaults.js";
import {
  buildDroidLaunchSpec,
  buildDroidSettings,
  resolveDroidSettingsPath,
  writeDroidSettings,
} from "../droid/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";
import { resolveTogetherApiKey, resolveTogetherBaseUrl } from "../together-core.js";

export default defineHarness({
  id: HARNESS.DROID,
  label: "Factory Droid",

  async run(ctx) {
    const apiKey = await resolveTogetherApiKey({ apiKey: ctx.apiKey, home: ctx.home });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveCodexModel(ctx.main);
    const baseUrl = resolveTogetherBaseUrl();
    const settingsPath = resolveDroidSettingsPath(ctx.home, baseUrl);
    await writeDroidSettings(settingsPath, buildDroidSettings({ selectedModel, baseUrl }));
    const launch = buildDroidLaunchSpec({
      selectedModel,
      apiKey,
      settingsPath,
      passthrough: ctx.passthrough ?? [],
    });

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink droid] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink droid] runtime settings: ${settingsPath}\n`);
    }

    process.stderr.write(
      "togetherlink ▸ Launching Factory Droid with Together AI (Factory login is still required).\n",
    );
    const result = await runTrackedSpawnedSession({
      agent: HARNESS.DROID,
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
