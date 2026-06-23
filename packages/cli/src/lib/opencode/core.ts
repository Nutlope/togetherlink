import { TOGETHER_API_KEY_ENV_REF } from "../together-core.js";
import {
  OPENCODE_PROVIDER_ID,
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_GLM52_MODEL_ENTRY,
  OPENCODE_BUILD_PROMPT,
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
 * self-branding. Highest precedence, no files — fully ephemeral.
 */
export function buildOpencodeConfigJson({
  modelId = OPENCODE_DEFAULT_MODEL,
  apiKeyEnvRef = TOGETHER_API_KEY_ENV_REF,
  buildPrompt = OPENCODE_BUILD_PROMPT,
}: {
  modelId?: string;
  apiKeyEnvRef?: string;
  buildPrompt?: string;
} = {}): OpencodeConfig {
  const provider: OpencodeProviderConfig = {
    npm: "@ai-sdk/togetherai",
    name: "Together AI",
    options: { apiKey: apiKeyEnvRef },
  };
  if (modelId === OPENCODE_DEFAULT_MODEL) {
    provider.models = { [modelId]: OPENCODE_GLM52_MODEL_ENTRY };
  }

  return {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [OPENCODE_PROVIDER_ID]: provider,
    },
    // Slash form: provider/model. GLM-5.2 is the primary (and only, by choice)
    // model — sub-agents inherit it automatically when no per-agent model is
    // set. To add a vision-capable sub-agent later, add an entry under
    // `agent` with mode "subagent" and a vision Together model id.
    model: `${OPENCODE_PROVIDER_ID}/${modelId}`,
    agent: {
      build: {
        prompt: buildPrompt,
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