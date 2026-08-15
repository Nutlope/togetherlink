import { rmSync } from "node:fs";
import { join } from "node:path";
import { CODEX_SUPPORTED_MODELS } from "../codex/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import {
  buildHermesLaunchSpec,
  createHermesHomeOverlay,
  resolveHermesCommand,
} from "../hermes/core.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";

export default defineHarness({
  id: HARNESS.HERMES,
  label: "Hermes Agent",
  run: async (ctx) => {
    const command = resolveHermesCommand(ctx.passthrough ?? []);
    const selectedModel = ctx.selectedModel.definition;
    const nativeHermesHome = process.env.HERMES_HOME?.trim() || join(ctx.home, ".hermes");
    const baseUrl = ctx.baseUrl;
    const modelIds = CODEX_SUPPORTED_MODELS.map((model) => model.id);
    if (!modelIds.includes(selectedModel.id)) modelIds.push(selectedModel.id);
    const hermesHome = createHermesHomeOverlay(nativeHermesHome, {
      baseUrl,
      modelIds,
    });
    const launch = buildHermesLaunchSpec({
      mode: command.mode,
      modelId: selectedModel.id,
      apiKey: ctx.apiKey,
      baseUrl,
      hermesHome,
      passthrough: command.passthrough,
    });

    if (process.env.TOGETHERLINK_DEBUG === "1") {
      process.stderr.write(`[togetherlink hermes] mode: ${command.mode}\n`);
      process.stderr.write(`[togetherlink hermes] model: ${selectedModel.id}\n`);
      process.stderr.write(`[togetherlink hermes] base URL: ${launch.env.TOGETHER_BASE_URL}\n`);
    }

    const desktopNote =
      command.mode === "desktop" ? " Quit an existing Hermes Desktop process first." : "";
    process.stderr.write(
      `togetherlink ▸ Launching ${command.mode === "desktop" ? "Hermes Desktop" : "Hermes"} with Together AI.${desktopNote}\n`,
    );

    const result = await runTrackedSpawnedSession({
      agent: "hermes",
      modelId: selectedModel.id,
      binary: launch.binary,
      args: launch.args,
      options: { env: launch.env, stdio: "inherit" },
      home: ctx.home,
    }).finally(() => {
      rmSync(hermesHome, { recursive: true, force: true });
    });

    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
