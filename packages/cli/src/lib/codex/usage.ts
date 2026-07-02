import { type ModelDefinition } from "@togetherlink/models";
import type { CostTracker } from "../claude/cost.js";
import type { ChatResponse } from "./wire-types.js";

type CodexUsageOptions = {
  costTracker?: CostTracker | undefined;
};

export function recordUsage(
  usage: ChatResponse["usage"],
  options: CodexUsageOptions,
  modelDefinition: ModelDefinition,
): void {
  if (!usage) {
    return;
  }
  options.costTracker?.addUsage(
    usage.prompt_tokens ?? 0,
    usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0,
    usage.completion_tokens ?? 0,
    modelDefinition,
  );
}
