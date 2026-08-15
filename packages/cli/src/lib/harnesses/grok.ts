import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGrokLaunchEnvironment,
  buildGrokIdentityRule,
  grokArgsWithTogetherlinkIdentity,
  startGrokModelCatalogServer,
} from "../grok/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessRunContext, type HarnessResult } from "../harness-types.js";
import { runTrackedSpawnedSession } from "../spawned-session.js";

export default defineHarness({
  id: HARNESS.GROK,
  label: "Grok Build",

  async run(ctx: HarnessRunContext): Promise<HarnessResult> {
    const selectedModel = ctx.selectedModel.definition;
    const baseUrl = ctx.baseUrl;
    const temporaryAuthDirectory = mkdtempSync(join(tmpdir(), "togetherlink-grok-auth-"));
    const authPath = join(temporaryAuthDirectory, "no-auth.json");
    let catalogServer: Awaited<ReturnType<typeof startGrokModelCatalogServer>> | undefined;
    try {
      catalogServer = await startGrokModelCatalogServer(baseUrl, [selectedModel]);
      const args = [
        "--model",
        selectedModel.id,
        ...grokArgsWithTogetherlinkIdentity(
          ctx.passthrough ?? [],
          buildGrokIdentityRule(selectedModel),
        ),
      ];
      const env = buildGrokLaunchEnvironment({
        inheritedEnv: process.env,
        apiKey: ctx.apiKey,
        authPath,
        baseUrl,
        modelsListUrl: catalogServer.modelsListUrl,
        selectedModel,
      });

      if (process.env.TOGETHERLINK_DEBUG === "1") {
        process.stderr.write(`[togetherlink grok] model: ${selectedModel.id}\n`);
        process.stderr.write(`[togetherlink grok] inference: ${baseUrl}\n`);
        process.stderr.write(`[togetherlink grok] model catalog: ${catalogServer.modelsListUrl}\n`);
        process.stderr.write(`[togetherlink grok] auth isolation: ${authPath}\n`);
        process.stderr.write(
          `[togetherlink grok] Grok home: ${env.GROK_HOME || "~/.grok (native default)"}\n`,
        );
      }

      process.stderr.write("togetherlink ▸ Launching Grok Build with Together AI.\n");
      const result = await runTrackedSpawnedSession({
        agent: HARNESS.GROK,
        modelId: selectedModel.id,
        binary: "grok",
        args,
        options: { env, stdio: "inherit" },
        home: ctx.home,
      });
      process.exitCode = typeof result.status === "number" ? result.status : result.signal ? 1 : 0;
    } finally {
      try {
        await catalogServer?.close();
      } finally {
        rmSync(temporaryAuthDirectory, { recursive: true, force: true });
      }
    }

    return {};
  },
});
