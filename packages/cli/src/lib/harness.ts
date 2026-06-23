export const HARNESS = {
  CLAUDE: "claude",
  CODEX: "codex",
  OPENCODE: "opencode",
} as const;

export type HarnessId = (typeof HARNESS)[keyof typeof HARNESS];

export const ALL_HARNESSES = [HARNESS.CLAUDE, HARNESS.CODEX, HARNESS.OPENCODE] as const;

// The CLI binary each harness ships, used for `which`-based detection.
export const HARNESS_BIN: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "claude",
  [HARNESS.CODEX]: "codex",
  [HARNESS.OPENCODE]: "opencode",
};

export const HARNESS_LABEL: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "Claude Code",
  [HARNESS.CODEX]: "Codex",
  [HARNESS.OPENCODE]: "OpenCode",
};
