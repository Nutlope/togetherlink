import { CLAUDE_DEFAULT_MODEL, CLAUDE_DEFAULT_TOGETHER_MODEL } from "../claude/defaults.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";
import { runClaudeTogether } from "../claude/core.js";

async function claudeResolveKey(ctx: HarnessContext): Promise<string> {
  return ctx.apiKey ?? process.env.TOGETHER_API_KEY?.trim() ?? "";
}

export default defineHarness({
  id: HARNESS.CLAUDE,
  label: "Claude Code",
  mode: "ephemeral",
  resolveKey: claudeResolveKey,

  async run(ctx) {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      resolveKey: () => claudeResolveKey(ctx),
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }

    const launchOptions = {
      apiKey,
      modelId: ctx.main ?? CLAUDE_DEFAULT_MODEL,
      ...(ctx.passthrough ? { args: ctx.passthrough } : {}),
    };
    const result = await runClaudeTogether(launchOptions);
    if (typeof result.status === "number") {
      process.exitCode = result.status;
    }
    return {};
  },

  async status() {
    return {
      payload: {
        harness: HARNESS.CLAUDE,
        mode: "ephemeral",
        provider: "local-together-proxy",
        currentModel: CLAUDE_DEFAULT_MODEL,
        targetModel: CLAUDE_DEFAULT_TOGETHER_MODEL,
      },
    };
  },
});
