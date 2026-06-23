export const OPENCODE_PROVIDER_ID = "togetherai";

// Real Together model id. OpenCode-facing selector is
// `${OPENCODE_PROVIDER_ID}/${OPENCODE_DEFAULT_MODEL}` (slash form, per the
// OpenCode config schema: "provider/model, eg anthropic/claude-2").
export const OPENCODE_DEFAULT_MODEL = "zai-org/GLM-5.2";
export const OPENCODE_DEFAULT_MODEL_NAME = "Together GLM 5.2";

/**
 * GLM-5.2 model entry — authoritative values from the models.dev PR
 * (github.com/anomalyco/models.dev/pull/2663). Declaring these inline lets
 * OpenCode enforce the real context/output limits, gate image attachments
 * client-side (GLM-5.2 is text-only — `attachment: false`, no image modality
 * means OpenCode won't send image parts to it, avoiding fake-vision), and
 * compute accurate cost locally from the per-token rates.
 *
 * Cost is per-token (OpenCode multiplies usage × these fields). Note: on
 * OpenCode ≤1.17.5 a known bug (#24113) made custom-adapter providers show
 * $0.00; the fix (PR #17645) was still open at time of writing. Declaring
 * cost here is correct and future-proof regardless.
 */
export const OPENCODE_GLM52_MODEL_ENTRY = {
  name: OPENCODE_DEFAULT_MODEL_NAME,
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  limit: {
    context: 262_144,
    output: 164_000,
  },
  modalities: {
    input: ["text"],
    output: ["text"],
  },
  cost: {
    input: 1.4,
    output: 4.4,
    cache_read: 0.26,
  },
} as const;

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
- If something fails, report the real output and adjust — don't claim success without evidence.`;