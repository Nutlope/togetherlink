import { TOGETHER_API_KEY_ENV_REF, TOGETHER_BASE_URL } from "../together-core.js";
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
   * (disabled_providers takes priority over enabled_providers, per the docs.)
   */
  disabled_providers?: string[];
  /**
   * The ONLY providers OpenCode loads; every other provider (Anthropic, OpenAI,
   * Gemini, Bedrock, Zen…) is ignored entirely. This is the strongest lockdown:
   * it can't hide the built-in "Connect provider" (ctrl+a) picker button — there
   * is no config field for that — but it means only `togetherai` is active, so
   * /models stays to our curated set and there's nothing else to switch to.
   */
  enabled_providers?: string[];
};

type OpencodeProviderConfig = {
  npm: string;
  name: string;
  options: { apiKey: string; baseURL: string };
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
 * Highest precedence for settings, with no OpenCode config files written.
 */
export function buildOpencodeConfigJson({
  modelId = OPENCODE_DEFAULT_MODEL,
  apiKeyEnvRef = TOGETHER_API_KEY_ENV_REF,
  baseUrl = TOGETHER_BASE_URL,
  buildPrompt = OPENCODE_BUILD_PROMPT,
  visionPrompt = OPENCODE_VISION_AGENT_PROMPT,
}: {
  modelId?: string;
  apiKeyEnvRef?: string;
  baseUrl?: string;
  buildPrompt?: string;
  visionPrompt?: string;
} = {}): OpencodeConfig {
  // Register every curated flagship (the full set /models shows) with their
  // real metadata + tip-bearing display names. The `@vision` subagent's model
  // (Kimi-K2.7-Code) is part of this set, so it's covered too.
  const models = { ...OPENCODE_MODEL_ENTRIES };

  const provider: OpencodeProviderConfig = {
    npm: "@ai-sdk/togetherai",
    // Provider label: OpenCode appends this provider `name` to every model
    // line in the /models picker (e.g. "GLM 5.2 · default  Together AI"). Kept
    // as the full brand name; the model display names are kept short so the
    // full suffix still fits without hitting the picker's truncation width
    // (opencode #20968).
    name: "Together AI",
    options: { apiKey: apiKeyEnvRef, baseURL: baseUrl },
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
    // Only load our Together provider; ignore every other provider (Anthropic,
    // OpenAI, Gemini, Bedrock, Zen…) so /models stays to the curated set.
    enabled_providers: [OPENCODE_PROVIDER_ID],
    // Belt-and-suspenders: also explicitly disable the Zen gateway (provider id
    // "opencode", the `opencode/*` namespace) — issue #6979 confirms the id is
    // "opencode", not "zen". disabled_providers takes priority over
    // enabled_providers, so this stays effective even if the precedence changes.
    disabled_providers: ["opencode"],
    agent: {
      build: {
        prompt: buildPrompt,
      },
      // Describes images the primary model can't see. NOTE: due to opencode
      // issue #25553, images attached via clipboard/@mention aren't forwarded to
      // subagents, so the build prompt tells text-only primaries NOT to auto-
      // invoke this (it only errors). The subagent stays available for explicit
      // @vision use and may work for file-attached images once #25553 is fixed.
      vision: {
        mode: "subagent",
        description:
          "Describes images the user attaches, for use by a text-only primary model. Because of an OpenCode bug (#25553) the image is not always forwarded to this subagent, so the primary agent does not auto-invoke it. You can still invoke it explicitly with @vision; if it reports it can't see the image, switch to a vision-capable model via /models instead.",
        model: OPENCODE_VISION_MODEL_SELECTOR,
        prompt: visionPrompt,
      },
    },
  };
}

/**
 * Env for the spawned `opencode` process: inline settings config (highest
 * precedence, never persisted) plus the resolved Together key so
 * `{env:TOGETHER_API_KEY}` substitution resolves inside the config.
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
