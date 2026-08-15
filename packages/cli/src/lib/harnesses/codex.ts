import { runCodexTogether } from "../codex/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessRunContext, type HarnessResult } from "../harness-types.js";

export default defineHarness({
  id: HARNESS.CODEX,
  label: "Codex",

  async run(ctx: HarnessRunContext): Promise<HarnessResult> {
    const selectedModel = ctx.selectedModel.definition;
    const result = await runCodexTogether({
      apiKey: ctx.apiKey,
      baseUrl: ctx.baseUrl,
      home: ctx.home,
      modelId: selectedModel.id,
      modelDefinition: selectedModel,
      ...(ctx.passthrough ? { args: ctx.passthrough } : {}),
    });
    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
