/**
 * Proxy-side cost tracking for GLM-5.2 on Together.
 *
 * Claude Code computes the `/usage` dollar figure locally from an Anthropic
 * pricing table it can't apply to a non-Anthropic model like `together-glm-5-2`,
 * so its estimate is wrong for us. Since the proxy is the one talking to
 * Together and holds the real token counts, it tracks cost itself using the
 * official GLM-5.2 rates from https://docs.together.ai/docs/glm-5.2-quickstart .
 *
 * Rates are per 1M tokens:
 *   input:  $1.40   cached input: $0.26   output: $4.40
 */

const TOKENS_PER_MILLION = 1_000_000;

export const GLM_5_2_PRICING = {
  inputPerToken: 1.4 / TOKENS_PER_MILLION,
  cachedInputPerToken: 0.26 / TOKENS_PER_MILLION,
  outputPerToken: 4.4 / TOKENS_PER_MILLION,
} as const;

export type TokenUsage = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
};

export class CostTracker {
  private promptTokens = 0;
  private cachedTokens = 0;
  private completionTokens = 0;
  private costUsd = 0;
  // Running totals snapshot at the start of the current /v1/messages request,
  // so we can report a per-request delta on top of the session total.
  private requestStartCost = 0;
  private requestStartPrompt = 0;
  private requestStartCached = 0;
  private requestStartCompletion = 0;

  /**
   * Begin a new /v1/messages request. A single request can span several
   * Together calls (tool loops); call this once per inbound request so the
   * per-request delta resets cleanly.
   */
  beginRequest(): void {
    this.requestStartCost = this.costUsd;
    this.requestStartPrompt = this.promptTokens;
    this.requestStartCached = this.cachedTokens;
    this.requestStartCompletion = this.completionTokens;
  }

  /**
   * Record one Together chat-completions call. `promptTokens` is the total
   * input token count Together reports; `cachedTokens` is the subset that hit
   * the shared prefix cache (Together's `cached_tokens` field) and is billed
   * at the discounted cached rate. Returns the incremental cost of this call.
   */
  addUsage(promptTokens: number, cachedTokens: number, completionTokens: number): number {
    const cached = Math.max(0, Math.min(cachedTokens, promptTokens));
    const nonCachedInput = Math.max(0, promptTokens - cached);
    const cost =
      nonCachedInput * GLM_5_2_PRICING.inputPerToken +
      cached * GLM_5_2_PRICING.cachedInputPerToken +
      completionTokens * GLM_5_2_PRICING.outputPerToken;

    this.promptTokens += promptTokens;
    this.cachedTokens += cached;
    this.completionTokens += completionTokens;
    this.costUsd += cost;
    return cost;
  }

  get totals(): TokenUsage {
    return {
      promptTokens: this.promptTokens,
      cachedTokens: this.cachedTokens,
      completionTokens: this.completionTokens,
      costUsd: this.costUsd,
    };
  }

  get requestDelta(): TokenUsage {
    return {
      promptTokens: this.promptTokens - this.requestStartPrompt,
      cachedTokens: this.cachedTokens - this.requestStartCached,
      completionTokens: this.completionTokens - this.requestStartCompletion,
      costUsd: this.costUsd - this.requestStartCost,
    };
  }

  /** One-line session summary suitable for a single stderr line at shutdown. */
  summarize(): string {
    return (
      `[togetherlink cost] session total: $${this.costUsd.toFixed(4)} ` +
      `(${this.formatTokens(this.promptTokens)} in` +
      (this.cachedTokens > 0 ? ` incl ${this.formatTokens(this.cachedTokens)} cached` : "") +
      `, ${this.formatTokens(this.completionTokens)} out)`
    );
  }

  private formatTokens(n: number): string {
    return n.toLocaleString("en-US");
  }
}