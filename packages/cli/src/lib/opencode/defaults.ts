import { GLM_5_2, VISION_MODELS, VISION_PRIMARY, VISION_PROMPT, type ModelDefinition } from "@togetherlink/models";

export const OPENCODE_PROVIDER_ID = "togetherai";

// Real Together model id. OpenCode-facing selector is
// `${OPENCODE_PROVIDER_ID}/${OPENCODE_DEFAULT_MODEL}` (slash form, per the
// OpenCode config schema: "provider/model, eg anthropic/claude-2").
export const OPENCODE_DEFAULT_MODEL = GLM_5_2.id;
export const OPENCODE_DEFAULT_MODEL_NAME = GLM_5_2.name;

/**
 * The shape of a model entry inside an OpenCode provider's `models` block.
 * Derived from a shared ModelDefinition so the per-harness OpenCode view can't
 * drift from the canonical facts.
 */
type OpencodeModelEntry = {
  name: string;
  attachment: boolean;
  reasoning: boolean;
  temperature: boolean;
  tool_call: boolean;
  limit: { context: number; output: number };
  modalities: { input: string[]; output: string[] };
  cost: { input: number; output: number; cache_read: number };
};

function toOpencodeModelEntry(model: ModelDefinition): OpencodeModelEntry {
  return {
    name: model.name,
    attachment: model.attachment,
    reasoning: model.reasoning,
    temperature: model.temperature,
    tool_call: model.tool_call,
    limit: { context: model.limit.context, output: model.limit.output },
    modalities: {
      input: [...model.modalities.input],
      output: [...model.modalities.output],
    },
    cost: { input: model.cost.input, output: model.cost.output, cache_read: model.cost.cache_read },
  };
}

/**
 * GLM-5.2 model entry for the OpenCode provider config. Declaring it inline
 * lets OpenCode enforce the real context/output limits, gate image attachments
 * client-side (GLM-5.2 is text-only — `attachment: false`, no image modality
 * means OpenCode won't send image parts to it, avoiding fake-vision), and
 * compute accurate cost locally from the per-token rates.
 */
export const OPENCODE_GLM52_MODEL_ENTRY = toOpencodeModelEntry(GLM_5_2);

/**
 * Vision-capable Together models registered under the provider so the `@vision`
 * subagent can use them. Only the primary (Kimi-K2.7-Code) is wired into the
 * subagent (OpenCode subagents take a single model), but every vision model is
 * registered so users can pick alternates via /models if they want.
 */
export const OPENCODE_VISION_MODEL_ENTRIES: Record<string, OpencodeModelEntry> = Object.fromEntries(
  VISION_MODELS.map((model) => [model.id, toOpencodeModelEntry(model)]),
);

/** Together id of the vision model the `@vision` subagent uses (the primary). */
export const OPENCODE_VISION_MODEL_ID = VISION_PRIMARY.id;

/** OpenCode selector form for the vision subagent's model: provider/<together-id>. */
export const OPENCODE_VISION_MODEL_SELECTOR = `${OPENCODE_PROVIDER_ID}/${OPENCODE_VISION_MODEL_ID}`;

/** Shared image-description prompt (re-exported for the subagent's system prompt). */
export { VISION_PROMPT as OPENCODE_VISION_PROMPT };

/**
 * Neutral system prompt for the primary `build` agent. Replaces OpenCode's
 * default "You are OpenCode, the best coding agent on the planet" framing so
 * the assistant doesn't self-identify as OpenCode when running on Together.
 * Keep it capability-focused and harness-agnostic; OpenCode merges this over
 * the built-in build agent, so its default tools/permissions are preserved.
 */
export const OPENCODE_BUILD_PROMPT = `You are a senior software engineering agent collaborating with the user in their workspace.

You have access to tools to read, edit, search, and run code. Use them deliberately: explore before changing, make focused edits that match the surrounding style, and verify your work by running the relevant tests or commands when possible.

- Prefer the smallest correct change. Don't refactor code you weren't asked to touch.
- When you're unsure about intent, ask a concise clarifying question rather than guessing.
- Explain trade-offs when a decision matters, and say plainly what you did and what you verified.
- If something fails, report the real output and adjust — don't claim success without evidence.

## Images (important)

You are a text-only model. You cannot see image attachments — OpenCode strips them
before they reach you. If the user attaches or pastes an image and asks about it,
do NOT pretend to see it or guess at its contents. Tell the user plainly that you
can't see images, and ask them to invoke the vision subagent by typing \`@vision\`
in their message (e.g. "\`@vision describe what's in the image I just attached\`").
The \`@vision\` subagent runs on a vision-capable model and will reply with a
description you can then reason over.`;

/**
 * System prompt for the `@vision` subagent. Builds on the shared
 * image-description prompt and adds the OpenCode subagent framing so the
 * agent knows it is invoked to describe attachments the main model can't see.
 */
export const OPENCODE_VISION_AGENT_PROMPT =
  `${VISION_PROMPT}\n\n` +
  "You are a vision subagent. You are invoked (as @vision) when the user attaches " +
  "an image that the primary model cannot see. Describe only what is in the image; " +
  "do not attempt file edits or other tool work. Keep your description tight so the " +
  "primary agent can reason over it.";