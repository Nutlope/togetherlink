import { resolveCodexModel } from "../codex/defaults.js";
import { runCodexTogether } from "../codex/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext, type HarnessResult } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";

export default defineHarness({
  id: HARNESS.CODEX,
  label: "Codex",

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveCodexModel(ctx.main);
    const result = await runCodexTogether({
      apiKey,
      modelId: selectedModel.id,
      ...(ctx.passthrough ? { args: ctx.passthrough } : {}),
    });
    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
