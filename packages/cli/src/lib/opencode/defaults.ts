import {
  GLM_5_2,
  SELECTABLE_MODELS,
  findModelById,
  isVisionModel,
  VISION_PRIMARY,
  VISION_PROMPT,
  type ModelDefinition,
} from "@togetherlink/models";

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
 * Curated model entries for the OpenCode provider config — the full set that
 * `/models` shows (Together's full serverless catalog is hidden via the
 * `whitelist`). Each entry's `name` carries a short user-facing tip, since
 * OpenCode model entries have no `description` field — the display name is the
 * only place a hint can live. Declaring them inline lets OpenCode enforce real
 * context/output limits, gate image attachments client-side, and compute
 * accurate cost locally from the per-token rates. The `@vision` subagent is
 * pinned to {@link OPENCODE_VISION_MODEL_ID} (Kimi-K2.7-Code), which is also in
 * this list.
 */
export const OPENCODE_MODEL_ENTRIES: Record<string, OpencodeModelEntry> = Object.fromEntries(
  SELECTABLE_MODELS.map((model) => [model.id, toOpencodeModelEntry(model)]),
);

/**
 * Whitelist of model ids that restricts the Together provider so `/models` shows
 * ONLY our curated set (opencode PR #3416). Without this, OpenCode merges our
 * declared models on top of Together's full models.dev catalog, surfacing
 * hundreds of unrelated models.
 */
export const OPENCODE_MODEL_WHITELIST: string[] = SELECTABLE_MODELS.map((model) => model.id);

/**
 * GLM-5.2 model entry for the OpenCode provider config. Declaring it inline
 * lets OpenCode enforce the real context/output limits, gate image attachments
 * client-side (GLM-5.2 is text-only — `attachment: false`, no image modality
 * means OpenCode won't send image parts to it, avoiding fake-vision), and
 * compute accurate cost locally from the per-token rates.
 */
export const OPENCODE_GLM52_MODEL_ENTRY = OPENCODE_MODEL_ENTRIES[GLM_5_2.id];

/** Together id of the vision model the `@vision` subagent uses (the primary). */
export const OPENCODE_VISION_MODEL_ID = VISION_PRIMARY.id;

/** OpenCode selector form for the vision subagent's model: provider/<together-id>. */
export const OPENCODE_VISION_MODEL_SELECTOR = `${OPENCODE_PROVIDER_ID}/${OPENCODE_VISION_MODEL_ID}`;

/** Shared image-description prompt (re-exported for the subagent's system prompt). */
export { VISION_PROMPT as OPENCODE_VISION_PROMPT };

/**
 * Resolve a selected model id to its ModelDefinition, defaulting to GLM-5.2 if
 * unknown. Used to pick the build-agent system prompt based on whether the
 * active model is vision-capable.
 */
export function resolveOpencodeModel(modelId: string): ModelDefinition {
  return findModelById(modelId) ?? GLM_5_2;
}

/** Whether a given Together model id (in our curated set) accepts images. */
export function isOpencodeVisionModel(modelId: string): boolean {
  return isVisionModel(resolveOpencodeModel(modelId));
}

/**
 * Neutral system prompt for the primary `build` agent. Replaces OpenCode's
 * default "You are OpenCode, the best coding agent on the planet" framing so
 * the assistant doesn't self-identify as OpenCode when running on Together.
 * Keep it capability-focused and harness-agnostic; OpenCode merges this over
 * the built-in build agent, so its default tools/permissions are preserved.
 *
 * This is ONE unified prompt: it lets the model self-select its image behavior
 * based on its own (runtime-known) capabilities, so it stays correct even when
 * the user switches models mid-session via /models (no per-launch prompt split
 * needed). Vision-capable models receive images directly and just use them;
 * text-only models notice the image bytes are withheld and route to @vision.
 */
export const OPENCODE_BUILD_PROMPT = `You are a senior software engineering agent collaborating with the user in their workspace.

You have access to tools to read, edit, search, and run code. Use them deliberately: explore before changing, make focused edits that match the surrounding style, and verify your work by running the relevant tests or commands when possible.

- Prefer the smallest correct change. Don't refactor code you weren't asked to touch.
- When you're unsure about intent, ask a concise clarifying question rather than guessing.
- Explain trade-offs when a decision matters, and say plainly what you did and what you verified.
- If something fails, report the real output and adjust — don't claim success without evidence.

## Images (self-select by your own capabilities)

Whether you can see images depends on which model you are running as — you know
this about yourself at runtime:

- **If you can see image content** (the attached image arrives to you as a real
  image part): use it directly. Describe, reason over, or act on it as needed.
  Do NOT delegate to any subagent for an image you can already see.
- **If you cannot see image content** (you are a text-only model; OpenCode
  strips image bytes before they reach you, though you may still be told an image
  was attached): do NOT pretend to see it and do NOT guess at its contents.
  Instead, **invoke the \`@vision\` subagent yourself via the Task tool** — launch
  the \`vision\` subagent with a request to describe the image the user just
  attached. It runs on a vision-capable model and returns a description you can
  reason over to answer the user. Only if \`@vision\` reports it also can't see
  the image, tell the user plainly and ask them to re-attach it with an explicit
  \`@vision\` mention.

Under no circumstances guess at or fabricate the contents of an image you did not
actually receive.`;

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