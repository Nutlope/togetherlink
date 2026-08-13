import type { ModelDefinition } from "@togetherlink/models";

/**
 * Shared, wire-uniform output-token budgeting for every harness.
 *
 * Two questions arise on both sides of every proxied request, and both are
 * pure arithmetic over the model's limits — no Anthropic/Responses wire shape
 * involved:
 *
 *   1. Before the call: how many output tokens may we ask Together for?
 *      (`resolveOutputBudget`)
 *   2. After the call: when Together says `finish_reason: "length"`, was the
 *      turn *actually* truncated? (`isTruncationReal`)
 *
 * These used to be answered twice — once in `claude/context-budget.ts` +
 * `claude/content-format.ts`, once inline in `codex/`. The copies drifted:
 * the Claude path capped output and distrusted short `length` stops, the
 * Codex path asked for the full model ceiling and trusted `length` verbatim,
 * so upstream noise that Claude Code shrugged off turned into a fatal
 * `response.incomplete` in Codex. Each harness still *renders* the answer in
 * its own wire format; only the decision lives here.
 */

/**
 * Headroom withheld from the context window so an input estimate that runs
 * slightly hot cannot push input + output past the model's limit.
 */
export const OUTPUT_SAFETY_TOKENS = 512;

/**
 * Smallest output budget worth asking for on a fresh request.
 *
 * Never request less than this proactively. An estimate-driven budget that
 * collapses toward zero produces an immediate `finish_reason: "length"` on
 * every attempt, which every harness reports as a truncation error rather
 * than as the context-pressure problem it actually is — a deterministic,
 * un-diagnosable loop. If the input genuinely leaves no room for this much
 * output, the request needs trimming (see `context-fit.ts`), not a
 * one-token reply.
 */
export const MIN_PREFERRED_OUTPUT_TOKENS = 8000;

export type OutputBudgetInput = {
  model: ModelDefinition;
  /**
   * Estimated prompt size. Pass 0/undefined when unknown — the budget then
   * falls back to the ceiling and the reactive `context-fit` retry handles any
   * overflow with Together's real count.
   */
  estimatedInputTokens?: number | undefined;
  /** Explicit per-request cap sent by the client, when it sent one. */
  clientMaxTokens?: number | undefined;
  /**
   * Harness-specific ceiling applied on top of the model limit. This stays a
   * caller decision: a low cap is only safe for a harness that continues a
   * truncated turn instead of failing it.
   */
  harnessCap?: number | undefined;
};

/**
 * Resolve the `max_tokens` to send upstream.
 *
 * Never returns less than `min(ceiling, MIN_PREFERRED_OUTPUT_TOKENS)`, so a
 * bad input estimate degrades into a short reply rather than a guaranteed
 * truncation error.
 */
export function resolveOutputBudget({
  model,
  estimatedInputTokens = 0,
  clientMaxTokens,
  harnessCap,
}: OutputBudgetInput): number {
  const ceiling = Math.max(
    1,
    Math.floor(
      Math.min(
        model.limit.output,
        finiteTokenCount(harnessCap) ?? Number.POSITIVE_INFINITY,
        finiteTokenCount(clientMaxTokens) ?? Number.POSITIVE_INFINITY,
      ),
    ),
  );
  const estimated = finiteTokenCount(estimatedInputTokens);
  if (estimated === undefined || estimated <= 0) {
    return ceiling;
  }
  const available = Math.floor(model.limit.context - estimated - OUTPUT_SAFETY_TOKENS);
  const floor = Math.min(ceiling, MIN_PREFERRED_OUTPUT_TOKENS);
  return Math.max(floor, Math.min(ceiling, available));
}

/**
 * Decide whether a `finish_reason: "length"` reflects a real truncation.
 *
 * Together reports `length` on turns that stopped far short of the requested
 * budget. Believing those throws away a complete reply — and, because the same
 * prompt reproduces the same spurious stop, every client retry fails
 * identically. Treat `length` as real only when the output actually approached
 * what we asked for; when usage is missing or unusable, believe it.
 */
export function isTruncationReal(
  finishReason: string | null | undefined,
  usage?:
    | { outputTokens?: number | undefined; requestedMaxTokens?: number | undefined }
    | undefined,
): boolean {
  if (finishReason !== "length") {
    return false;
  }
  const outputTokens = finiteTokenCount(usage?.outputTokens);
  const requestedMaxTokens = finiteTokenCount(usage?.requestedMaxTokens);
  if (outputTokens === undefined || requestedMaxTokens === undefined) {
    return true;
  }
  const output = Math.max(0, Math.floor(outputTokens));
  const requested = Math.max(1, Math.floor(requestedMaxTokens));
  if (output >= requested) {
    return true;
  }
  return output >= Math.floor(requested * 0.9) || requested - output <= 1024;
}

function finiteTokenCount(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
