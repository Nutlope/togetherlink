import {
  opencodePathsFor,
  opencodeProviderStatus,
  opencodeCurrentModelId,
  enableTogetherOpencode,
  disableTogetherOpencode,
} from "../opencode-core.js";
import { readJsonIfExists, resolveTogetherApiKey } from "../together-core.js";
import { isHarnessEnabled, setHarnessEnabled } from "../global-config.js";
import { defineHarness } from "../harness-types.js";
import { HARNESS } from "../harness.js";
import type { HarnessContext } from "../harness-types.js";

// TODO: replace with the curated remote models.json default once that
// manifest exists (see plan: "Default model picks come from a separate,
// remotely-updatable curated manifest"). Placeholder is a real, current
// Together coding model, not a fabricated id.
const PLACEHOLDER_DEFAULT_MODEL = "Qwen/Qwen3-Coder-30B-A3B-Instruct";

async function opencodeResolveKey(ctx: HarnessContext): Promise<string> {
  const { authPath } = opencodePathsFor(ctx);
  const auth = await readJsonIfExists<Record<string, { key?: string } | undefined>>(authPath);
  return auth.togetherai?.key ?? "";
}

export default defineHarness({
  id: HARNESS.OPENCODE,
  label: "OpenCode",
  resolveKey: opencodeResolveKey,

  async on(ctx) {
    const { configPath, authPath, dataDir } = opencodePathsFor(ctx);
    const apiKey = await resolveTogetherApiKey({
      apiKey: ctx.apiKey,
      resolveKey: () => opencodeResolveKey(ctx),
      home: ctx.home,
    });
    if (!apiKey) {
      throw new Error("No Together API key found. Pass --api-key or set TOGETHER_API_KEY.");
    }
    const result = await enableTogetherOpencode({
      configPath,
      authPath,
      dataDir,
      apiKey,
      modelId: ctx.main ?? PLACEHOLDER_DEFAULT_MODEL,
    });
    await setHarnessEnabled(ctx.home, HARNESS.OPENCODE, true);
    return {
      message: `Together AI enabled for OpenCode (model: ${result.model}). Run \`opencode\` directly from now on — Together appears as a provider choice.`,
    };
  },

  async off(ctx) {
    const { configPath, authPath, dataDir } = opencodePathsFor(ctx);
    const wasEnabled = await isHarnessEnabled(ctx.home, HARNESS.OPENCODE);
    const outcome = await disableTogetherOpencode({ configPath, authPath, dataDir, wasEnabled });
    await setHarnessEnabled(ctx.home, HARNESS.OPENCODE, false);
    return {
      message:
        outcome === "restored"
          ? "Together AI disabled for OpenCode; original config restored."
          : "Together AI was not active for OpenCode.",
    };
  },

  async status(ctx) {
    const { configPath } = opencodePathsFor(ctx);
    const config = await readJsonIfExists(configPath);
    const payload = {
      harness: HARNESS.OPENCODE,
      provider: opencodeProviderStatus(config),
      currentModel: opencodeCurrentModelId(config),
    };
    return { payload };
  },
});
