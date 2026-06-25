export type AgentId = "codex" | "claude" | "opencode" | "pi";

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
  stdout: string;
  stderr: string;
};

export type TestContext = {
  repoRoot: string;
  cliBin: string;
  artifactsDir: string;
  tmpDir: string;
  results: TestResult[];
};

export type Scenario = {
  name: string;
  run: (context: TestContext) => Promise<void>;
};
