export const REASONING_HISTORY_ENV = "TOGETHERLINK_REASONING_HISTORY";

export const REASONING_HISTORY_MODES = ["off", "interleaved", "full"] as const;

export type ReasoningHistoryMode = (typeof REASONING_HISTORY_MODES)[number];

export const DEFAULT_REASONING_HISTORY_MODE: ReasoningHistoryMode = "full";

export function isReasoningHistoryMode(value: unknown): value is ReasoningHistoryMode {
  return REASONING_HISTORY_MODES.includes(value as ReasoningHistoryMode);
}

export function resolveReasoningHistoryMode(
  env: NodeJS.ProcessEnv = process.env,
): ReasoningHistoryMode {
  const raw = env[REASONING_HISTORY_ENV]?.trim();
  if (!raw) {
    return DEFAULT_REASONING_HISTORY_MODE;
  }
  const normalized = raw.toLowerCase();
  if (isReasoningHistoryMode(normalized)) {
    return normalized;
  }
  throw new Error(
    `${REASONING_HISTORY_ENV} must be one of: ${REASONING_HISTORY_MODES.join(", ")}. Received ${JSON.stringify(raw)}.`,
  );
}

export function reasoningHistoryPolicy(mode?: ReasoningHistoryMode): {
  includeHistoricalReasoning: boolean;
  clearThinking: boolean;
} {
  const effectiveMode = mode ?? DEFAULT_REASONING_HISTORY_MODE;
  return {
    includeHistoricalReasoning: effectiveMode !== "off",
    clearThinking: effectiveMode !== "full",
  };
}
