import { CODEX_DEFAULT_MODEL, CODEX_DEFAULT_MODEL_NAME, CODEX_SUPPORTED_MODELS, resolveCodexModel } from "../codex/defaults.js";
import { runCodexTogether } from "../codex/core.js";
import { HARNESS } from "../harness.js";
import { defineHarness, type HarnessContext, type HarnessResult } from "../harness-types.js";
import { resolveTogetherApiKey } from "../together-core.js";

async function codexResolveKey(ctx: HarnessContext): Promise<string> {
  return ctx.apiKey ?? process.env.TOGETHER_API_KEY?.trim() ?? "";
}

export default defineHarness({
  id: HARNESS.CODEX,
  label: "Codex",
  mode: "ephemeral",
  resolveKey: codexResolveKey,

  async run(ctx: HarnessContext): Promise<HarnessResult> {
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      resolveKey: () => codexResolveKey(ctx),
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

  async status(): Promise<HarnessResult> {
    return {
      payload: {
        harness: HARNESS.CODEX,
        mode: "ephemeral",
        provider: "local-responses-to-together-proxy",
        currentModel: CODEX_DEFAULT_MODEL,
        targetModel: CODEX_DEFAULT_MODEL,
        modelName: CODEX_DEFAULT_MODEL_NAME,
        supportedModels: CODEX_SUPPORTED_MODELS.map((model) => model.id).join(", "),
      },
    };
  },
});
