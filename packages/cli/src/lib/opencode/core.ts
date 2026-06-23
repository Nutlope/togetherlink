import { TOGETHER_API_KEY_ENV_REF } from "../together-core.js";
import {
  OPENCODE_PROVIDER_ID,
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_MODEL_ENTRIES,
  OPENCODE_MODEL_WHITELIST,
  OPENCODE_VISION_MODEL_SELECTOR,
  OPENCODE_BUILD_PROMPT,
  OPENCODE_VISION_AGENT_PROMPT,
} from "./defaults.js";

type OpencodeConfig = {
  $schema?: string;
  model?: string;
  provider?: Record<string, Record<string, unknown>>;
  agent?: Record<string, Record<string, unknown>>;
  /**
   * Provider ids OpenCode won't auto-load. We disable "opencode" — the Zen
   * gateway provider (its models are registered under the `opencode/*`
   * namespace, not `zen/*`, per opencode issue #6979). togetherlink routes
   * everything to Together, so Zen's auto-loaded models are pure clutter in
   * the picker; this keeps /models to only the Together flagships we curate.
   */
  disabled_providers?: string[];
};

type OpencodeProviderConfig = {
  npm: string;
  name: string;
  options: { apiKey: string };
  models?: Record<string, unknown>;
  /**
   * Restricts the provider so ONLY these model ids appear in /models
   * (otherwise OpenCode merges our declared models on top of Together's full
   * models.dev catalog, surfacing hundreds of unrelated models). Added in
   * opencode PR #3416: "Whitelist restricts to only specified models
   * (empty whitelist = no models); blacklist is treated over whitelist."
   */
  whitelist?: string[];
};

/**
 * Builds the inline OpenCode config passed via `OPENCODE_CONFIG_CONTENT`.
 * Registers Together as a provider (first-party `@ai-sdk/togetherai` adapter,
 * which already knows Together's base URL) and defaults the model to GLM 5.2
 * with its full capability/cost/limit metadata. The key is resolved at runtime
 * via `{env:TOGETHER_API_KEY}` so no credential is written to disk (no
 * auth.json). The `build` agent's system prompt is overridden to drop OpenCode
 * self-branding, and a `vision` subagent is added on a vision-capable Together
 * model so pasted images can be described (GLM-5.2 is text-only — this is the
 * OpenCode-native equivalent of the Claude proxy's image interception).
 * Highest precedence, no files — fully ephemeral.
 */
export function buildOpencodeConfigJson({
  modelId = OPENCODE_DEFAULT_MODEL,
  apiKeyEnvRef = TOGETHER_API_KEY_ENV_REF,
  buildPrompt = OPENCODE_BUILD_PROMPT,
  visionPrompt = OPENCODE_VISION_AGENT_PROMPT,
}: {
  modelId?: string;
  apiKeyEnvRef?: string;
  buildPrompt?: string;
  visionPrompt?: string;
} = {}): OpencodeConfig {
  // Register every curated flagship (the full set /models shows) with their
  // real metadata + tip-bearing display names. The `@vision` subagent's model
  // (Kimi-K2.7-Code) is part of this set, so it's covered too.
  const models = { ...OPENCODE_MODEL_ENTRIES };

  const provider: OpencodeProviderConfig = {
    npm: "@ai-sdk/togetherai",
    name: "Together AI",
    options: { apiKey: apiKeyEnvRef },
    models,
    // Restrict /models to exactly the curated set. Without this, OpenCode also
    // shows Together's full catalog (hundreds of models) because the `models`
    // block merges onto the provider's models.dev catalog rather than replacing
    // it (opencode PR #3416 added whitelist/blacklist filtering).
    whitelist: OPENCODE_MODEL_WHITELIST,
  };

  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [OPENCODE_PROVIDER_ID]: provider,
    },
    // Slash form: provider/model. The selected model is the primary; sub-agents
    // without an explicit model inherit it automatically. The `vision` subagent
    // explicitly pins a vision-capable Together model (Kimi-K2.7-Code) so a
    // text-only primary can still describe pasted images. To add more
    // sub-agents later, add entries under `agent`.
    model: `${OPENCODE_PROVIDER_ID}/${modelId}`,
    // Disable OpenCode's auto-loaded Zen gateway (provider id "opencode", the
    // `opencode/*` namespace) so /models shows only our curated Together
    // flagships — not Zen's tested-model list. opencode issue #6979 confirms
    // the id is "opencode", not "zen".
    disabled_providers: ["opencode"],
    agent: {
      build: {
        prompt: buildPrompt,
      },
      // Describes images the primary model can't see. The unified build prompt
      // tells a text-only primary to invoke this automatically via the Task tool
      // when it detects an image was attached; vision primaries see images
      // directly and don't need it. Users can also @mention it.
      vision: {
        mode: "subagent",
        description:
          "Describes images the user attaches or pastes. Invoke this subagent automatically (via the Task tool) whenever an image was attached and you can't see it, so you can reason over the description. Users may also invoke it with @vision.",
        model: OPENCODE_VISION_MODEL_SELECTOR,
        prompt: visionPrompt,
      },
    },
  };
}

/**
 * Env for the spawned `opencode` process: inline config (highest precedence,
 * never persisted) plus the resolved Together key so `{env:TOGETHER_API_KEY}`
 * substitution resolves inside the config.
 */
export function buildOpencodeEnv({
  apiKey,
  configJson,
}: {
  apiKey: string;
  configJson: OpencodeConfig;
}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(configJson),
    TOGETHER_API_KEY: apiKey,
  };
}