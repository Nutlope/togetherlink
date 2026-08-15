import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { runClaudeTogether } from "../claude/core.js";

export default defineHarness({
  id: HARNESS.CLAUDE,
  label: "Claude Code",

  async run(ctx) {
    const selectedModel = ctx.selectedModel.definition;
    const launchOptions = {
      apiKey: ctx.apiKey,
      baseUrl: ctx.baseUrl,
      modelId: selectedModel.anthropicAlias ?? selectedModel.id,
      modelDefinition: selectedModel,
      ...(ctx.passthrough ? { args: ctx.passthrough } : {}),
    };
    const result = await runClaudeTogether(launchOptions);
    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
