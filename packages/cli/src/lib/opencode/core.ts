import { TOGETHER_API_KEY_ENV_REF } from "../together-core.js";
import {
  OPENCODE_PROVIDER_ID,
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_GLM52_MODEL_ENTRY,
  OPENCODE_VISION_MODEL_ENTRIES,
  OPENCODE_VISION_MODEL_SELECTOR,
  OPENCODE_BUILD_PROMPT,
  OPENCODE_VISION_AGENT_PROMPT,
} from "./defaults.js";

type OpencodeConfig = {
  $schema?: string;
  model?: string;
  provider?: Record<string, Record<string, unknown>>;
  agent?: Record<string, Record<string, unknown>>;
};

type OpencodeProviderConfig = {
  npm: string;
  name: string;
  options: { apiKey: string };
  models?: Record<string, unknown>;
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
  const models: Record<string, unknown> = {};
  if (modelId === OPENCODE_DEFAULT_MODEL) {
    models[modelId] = OPENCODE_GLM52_MODEL_ENTRY;
  }
  // Always register the vision models so the @vision subagent (and /models)
  // can use them, regardless of the primary model.
  for (const [id, entry] of Object.entries(OPENCODE_VISION_MODEL_ENTRIES)) {
    models[id] = entry;
  }

  const provider: OpencodeProviderConfig = {
    npm: "@ai-sdk/togetherai",
    name: "Together AI",
    options: { apiKey: apiKeyEnvRef },
    models,
  };

  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [OPENCODE_PROVIDER_ID]: provider,
    },
    // Slash form: provider/model. GLM-5.2 is the primary (and only general-use)
    // model — sub-agents without an explicit model inherit it automatically.
    // The `vision` subagent explicitly pins a vision-capable Together model.
    // To add more sub-agents later, add entries under `agent`.
    model: `${OPENCODE_PROVIDER_ID}/${modelId}`,
    agent: {
      build: {
        prompt: buildPrompt,
      },
      // GLM-5.2 can't see images; this subagent describes them on request.
      // Invoke via @vision when the user pastes/attaches an image.
      vision: {
        mode: "subagent",
        description:
          "Describes images the user pastes or attaches. Use @vision when the main model can't see an image.",
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