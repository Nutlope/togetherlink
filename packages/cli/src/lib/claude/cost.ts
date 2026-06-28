import { GLM_5_2, VISION_MODELS, costPerToken, type ModelDefinition } from "@togetherlink/models";

/**
 * Proxy-side cost tracking for the selected Together model.
 *
 * Claude Code computes the `/usage` dollar figure locally from an Anthropic
 * pricing table it can't apply to non-Anthropic Together models,
 * so its estimate is wrong for us. Since the proxy is the one talking to
 * Together and holds the real token counts, it tracks cost itself using the
 * selected model's rates from @togetherlink/models.
 */

function pricingFor(model: ModelDefinition): { inputPerToken: number; cachedInputPerToken: number; outputPerToken: number } {
  return {
    inputPerToken: costPerToken(model.cost.input),
    cachedInputPerToken: costPerToken(model.cost.cache_read),
    outputPerToken: costPerToken(model.cost.output),
  };
}

// Per-token pricing for the vision models used by the image intercept, keyed by
// the API model string. Built from the shared VISION_MODELS manifest so the
// rates can't drift from the rest of the codebase.
const VISION_PRICING: Record<string, { inputPerToken: number; cachedPerToken: number; outputPerToken: number }> =
  Object.fromEntries(
    VISION_MODELS.map((model) => [
      model.id,
      {
        inputPerToken: costPerToken(model.cost.input),
        cachedPerToken: costPerToken(model.cost.cache_read),
        outputPerToken: costPerToken(model.cost.output),
      },
    ]),
  );

export type TokenUsage = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type ModelTokenUsage = TokenUsage & { model: string };

export class CostTracker {
  private readonly defaultMainModel: ModelDefinition;
  private promptTokens = 0;
  private cachedTokens = 0;
  private completionTokens = 0;
  private costUsd = 0;
  // Per-model breakdown, keyed by the real Together model id used for each
  // call. addUsage already resolves the actual model per request (it can
  // differ from the session's launch-time model when Claude Code's own
  // /model picker switches tiers without relaunching), so this is the only
  // place that knows the true usage split — the flat totals above discard it.
  private readonly byModel = new Map<string, TokenUsage>();
  // Vision sub-call spend is tracked separately so the summary can show it
  // distinctly and so we never mix GLM-5.2 rates with vision-model rates.
  private visionCalls = 0;
  private visionPromptTokens = 0;
  private visionCompletionTokens = 0;
  private visionCostUsd = 0;
  private externalSummary: string | undefined;
  // Running totals snapshot at the start of the current /v1/messages request,
  // so we can report a per-request delta on top of the session total.
  private requestStartCost = 0;
  private requestStartPrompt = 0;
  private requestStartCached = 0;
  private requestStartCompletion = 0;

  constructor(mainModel: ModelDefinition = GLM_5_2) {
    this.defaultMainModel = mainModel;
  }

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
  addUsage(
    promptTokens: number,
    cachedTokens: number,
    completionTokens: number,
    model: ModelDefinition = this.defaultMainModel,
  ): number {
    const pricing = pricingFor(model);
    const cached = Math.max(0, Math.min(cachedTokens, promptTokens));
    const nonCachedInput = Math.max(0, promptTokens - cached);
    const cost =
      nonCachedInput * pricing.inputPerToken +
      cached * pricing.cachedInputPerToken +
      completionTokens * pricing.outputPerToken;

    this.promptTokens += promptTokens;
    this.cachedTokens += cached;
    this.completionTokens += completionTokens;
    this.costUsd += cost;

    const bucket = this.byModel.get(model.id) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
    bucket.promptTokens += promptTokens;
    bucket.cachedTokens += cached;
    bucket.completionTokens += completionTokens;
    bucket.costUsd += cost;
    this.byModel.set(model.id, bucket);

    return cost;
  }

  /**
   * Record one image-description sub-call to a vision model. Billed at that
   * model's own rates (not GLM-5.2's). Vision cached-token discounts vary per
   * model and aren't always reported; treated as 0 when absent.
   */
  addVisionUsage(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = VISION_PRICING[model];
    if (!pricing) {
      return 0;
    }
    const cost = promptTokens * pricing.inputPerToken + completionTokens * pricing.outputPerToken;
    this.visionCalls += 1;
    this.visionPromptTokens += promptTokens;
    this.visionCompletionTokens += completionTokens;
    this.visionCostUsd += cost;
    this.costUsd += cost;

    const bucket = this.byModel.get(model) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
    bucket.promptTokens += promptTokens;
    bucket.completionTokens += completionTokens;
    bucket.costUsd += cost;
    this.byModel.set(model, bucket);

    return cost;
  }

  setExternalSummary(summary: string): void {
    this.externalSummary = summary;
  }

  hydrateUsage(totals: Partial<TokenUsage>, externalSummary?: string): void {
    this.promptTokens = totals.promptTokens ?? 0;
    this.cachedTokens = Math.max(0, Math.min(totals.cachedTokens ?? 0, this.promptTokens));
    this.completionTokens = totals.completionTokens ?? 0;
    this.costUsd = totals.costUsd ?? 0;
    this.externalSummary = externalSummary;
    // Hydration restores a flat snapshot (e.g. daemon restart recovery), which
    // has no per-model breakdown. Fold it into the default model's bucket
    // rather than losing it from the breakdown entirely.
    this.byModel.set(this.defaultMainModel.id, { ...this.totals });
    this.beginRequest();
  }

  get totals(): TokenUsage {
    return {
      promptTokens: this.promptTokens,
      cachedTokens: this.cachedTokens,
      completionTokens: this.completionTokens,
      costUsd: this.costUsd,
    };
  }

  /** Per-model usage breakdown, e.g. when Claude Code's /model picker switches tiers mid-session. */
  get totalsByModel(): ModelTokenUsage[] {
    return Array.from(this.byModel.entries()).map(([model, usage]) => ({ model, ...usage }));
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
    if (this.externalSummary) {
      return this.externalSummary;
    }
    const main =
      `[togetherlink cost] session total: $${this.costUsd.toFixed(4)} ` +
      `(${this.formatTokens(this.promptTokens)} in` +
      (this.cachedTokens > 0 ? ` incl ${this.formatTokens(this.cachedTokens)} cached` : "") +
      `, ${this.formatTokens(this.completionTokens)} out)`;
    if (this.visionCalls > 0) {
      return (
        `${main}\n[togetherlink cost] vision: ${this.visionCalls} image(s), ` +
        `$${this.visionCostUsd.toFixed(4)} ` +
        `(${this.formatTokens(this.visionPromptTokens)} in, ${this.formatTokens(this.visionCompletionTokens)} out)`
      );
    }
    return main;
  }

  private formatTokens(n: number): string {
    return n.toLocaleString("en-US");
  }
}
