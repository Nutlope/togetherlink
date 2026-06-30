import { resolveClaudeModel } from "../claude/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";
import { runClaudeTogether } from "../claude/core.js";

export default defineHarness({
  id: HARNESS.CLAUDE,
  label: "Claude Code",

  async run(ctx) {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const selectedModel = resolveClaudeModel(ctx.main);
    const launchOptions = {
      apiKey,
      modelId: selectedModel.alias,
      ...(ctx.passthrough ? { args: ctx.passthrough } : {}),
    };
    const result = await runClaudeTogether(launchOptions);
    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },
});
