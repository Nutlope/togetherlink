export const HARNESS = {
  CLAUDE: "claude",
  CODEX: "codex",
  OPENCODE: "opencode",
  PI: "pi",
} as const;

export type HarnessId = (typeof HARNESS)[keyof typeof HARNESS];

export const ALL_HARNESSES = [HARNESS.CLAUDE, HARNESS.CODEX, HARNESS.OPENCODE, HARNESS.PI] as const;

// The CLI binary each harness ships, used for `which`-based detection.
export const HARNESS_BIN: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "claude",
  [HARNESS.CODEX]: "codex",
  [HARNESS.OPENCODE]: "opencode",
  [HARNESS.PI]: "pi",
};

export const HARNESS_LABEL: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "Claude Code",
  [HARNESS.CODEX]: "Codex",
  [HARNESS.OPENCODE]: "OpenCode",
  [HARNESS.PI]: "Pi Code",
};

export const HARNESS_INSTALL: Record<HarnessId, { command: string; url: string }> = {
  [HARNESS.CLAUDE]: {
    command: "npm install -g @anthropic-ai/claude-code",
    url: "https://docs.anthropic.com/en/docs/claude-code/setup",
  },
  [HARNESS.CODEX]: {
    command: "npm install -g @openai/codex",
    url: "https://github.com/openai/codex",
  },
  [HARNESS.OPENCODE]: {
    command: "npm install -g opencode-ai",
    url: "https://opencode.ai/docs",
  },
  [HARNESS.PI]: {
    command: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
    url: "https://pi.dev/docs/latest/quickstart",
  },
};
