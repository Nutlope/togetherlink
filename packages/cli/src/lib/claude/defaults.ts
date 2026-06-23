import { GLM_5_2, GLM_5_2_ANTHROPIC_CAPABILITIES } from "@togetherlink/models";

export const CLAUDE_LOCAL_PROXY_HOST = "127.0.0.1";
// ANTHROPIC_MODEL alias Claude Code sees for GLM-5.2 through the proxy.
export const CLAUDE_DEFAULT_MODEL = GLM_5_2.anthropicAlias ?? "together-glm-5-2";
export const CLAUDE_DEFAULT_MODEL_NAME = GLM_5_2.name;
export const CLAUDE_DEFAULT_TOGETHER_MODEL = GLM_5_2.id;
export const CLAUDE_MODEL_CAPABILITIES = GLM_5_2_ANTHROPIC_CAPABILITIES;