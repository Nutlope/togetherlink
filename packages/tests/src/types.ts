export type AgentId = "codex" | "codex-app" | "claude" | "grok" | "opencode" | "pi";

export type TestStatus = "passed" | "failed";

export type TestResult = {
  name: string;
  status: TestStatus;
  durationMs: number;
  error?: string;
};

export type CommandResult = {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  status: number;
  timedOut?: boolean;
  stdout: string;
  stderr: string;
};

export type TestContext = {
  repoRoot: string;
  cliBin: string;
  artifactsDir: string;
  tmpDir: string;
  togetherlinkHome?: string;
  daemonPort?: number;
  results: TestResult[];
};

export type Scenario = {
  name: string;
  run: (context: TestContext) => Promise<void>;
};
