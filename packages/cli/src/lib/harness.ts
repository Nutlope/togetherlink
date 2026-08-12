export const HARNESS = {
  CLAUDE: "claude",
  CODEX: "codex",
  GROK: "grok",
  HERMES: "hermes",
  OPENCODE: "opencode",
  PI: "pi",
  PRIME: "prime",
} as const;

export type HarnessId = (typeof HARNESS)[keyof typeof HARNESS];

export const ALL_HARNESSES = [
  HARNESS.CLAUDE,
  HARNESS.CODEX,
  HARNESS.GROK,
  HARNESS.HERMES,
  HARNESS.OPENCODE,
  HARNESS.PI,
  HARNESS.PRIME,
] as const;

// The CLI binary each harness ships, used for `which`-based detection.
export const HARNESS_BIN: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "claude",
  [HARNESS.CODEX]: "codex",
  [HARNESS.GROK]: "grok",
  [HARNESS.HERMES]: "hermes",
  [HARNESS.OPENCODE]: "opencode",
  [HARNESS.PI]: "pi",
  [HARNESS.PRIME]: "prime-agent",
};

export const HARNESS_LABEL: Record<HarnessId, string> = {
  [HARNESS.CLAUDE]: "Claude Code",
  [HARNESS.CODEX]: "Codex",
  [HARNESS.GROK]: "Grok Build",
  [HARNESS.HERMES]: "Hermes Agent",
  [HARNESS.OPENCODE]: "OpenCode",
  [HARNESS.PI]: "Pi Code",
  [HARNESS.PRIME]: "Prime Agent",
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
  [HARNESS.GROK]: {
    command: "curl -fsSL https://x.ai/cli/install.sh | bash",
    url: "https://github.com/xai-org/grok-build",
  },
  [HARNESS.HERMES]: {
    command: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
    url: "https://hermes-agent.nousresearch.com/docs/",
  },
  [HARNESS.OPENCODE]: {
    command: "npm install -g opencode-ai@latest",
    url: "https://github.com/anomalyco/opencode",
  },
  [HARNESS.PI]: {
    command: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
    url: "https://pi.dev/docs/latest/quickstart",
  },
  [HARNESS.PRIME]: {
    command: "curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh",
    url: "https://github.com/PrimeIntellect-ai/prime-agent",
  },
};
