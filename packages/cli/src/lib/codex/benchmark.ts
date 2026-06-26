import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { HarnessContext } from "../harness-types.js";

type BenchmarkCase = {
  id: "openai" | "togetherlink";
  label: string;
  command: string;
  args: string[];
};

type BenchmarkResult = {
  id: BenchmarkCase["id"];
  label: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  outputText?: string;
  usage?: Record<string, unknown>;
  error?: string;
};

const DEFAULT_PROMPT = "Reply with exactly: hi";
const DEFAULT_TIMEOUT_MS = 120_000;

export async function runCodexBenchmark(flags: Partial<HarnessContext> & { json?: boolean }): Promise<void> {
  const prompt = process.env.TOGETHERLINK_CODEX_BENCH_PROMPT || DEFAULT_PROMPT;
  const timeoutMs = timeoutFromEnv();
  const cases = benchmarkCases(prompt, flags.main);
  const results: BenchmarkResult[] = [];

  for (const testCase of cases) {
    process.stderr.write(`togetherlink benchmark ▸ running ${testCase.label}\n`);
    results.push(await runCase(testCase, timeoutMs));
  }

  if (flags.json) {
    console.log(JSON.stringify({ prompt, timeoutMs, results }, null, 2));
    return;
  }

  console.log("togetherlink Codex benchmark");
  console.log(`Prompt: ${JSON.stringify(prompt)}`);
  console.log("");
  for (const result of results) {
    const ok = result.status === 0;
    console.log(`${result.label}: ${ok ? "ok" : "failed"} in ${formatMs(result.durationMs)}`);
    if (result.outputText) {
      console.log(`  output: ${JSON.stringify(result.outputText)}`);
    }
    if (result.usage) {
      console.log(`  usage: ${formatUsage(result.usage)}`);
    }
    if (result.error) {
      console.log(`  error: ${result.error}`);
    }
  }

  const openai = results.find((result) => result.id === "openai" && result.status === 0);
  const togetherlink = results.find((result) => result.id === "togetherlink" && result.status === 0);
  if (openai && togetherlink) {
    const delta = openai.durationMs - togetherlink.durationMs;
    const ratio = openai.durationMs / togetherlink.durationMs;
    console.log("");
    console.log(
      `Delta: togetherlink was ${formatMs(Math.abs(delta))} ${delta >= 0 ? "faster" : "slower"} (${ratio.toFixed(2)}x direct/OpenAI elapsed ratio).`,
    );
  }
}

function benchmarkCases(prompt: string, modelId: string | undefined): BenchmarkCase[] {
  return [
    {
      id: "openai",
      label: "Direct Codex/OpenAI",
      command: "codex",
      args: codexExecArgs(prompt),
    },
    {
      id: "togetherlink",
      label: "togetherlink Codex/Together",
      command: process.execPath,
      args: [currentTogetherlinkBin(), ...(modelId ? ["--main", modelId] : []), "codex", ...codexExecArgs(prompt)],
    },
  ];
}

function codexExecArgs(prompt: string): string[] {
  return ["exec", "--ephemeral", "--ignore-rules", "--skip-git-repo-check", "--json", prompt];
}

async function runCase(testCase: BenchmarkCase, timeoutMs: number): Promise<BenchmarkResult> {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const child = spawn(testCase.command, testCase.args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  const { status, signal } = await new Promise<{ status: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("error", (error) => {
      stderr += error.message;
      resolve({ status: 1, signal: null });
    });
    child.on("exit", (exitStatus, exitSignal) => resolve({ status: exitStatus, signal: exitSignal }));
  });
  clearTimeout(timeout);

  const parsed = parseCodexJsonl(stdout);
  const error = timedOut ? `timed out after ${formatMs(timeoutMs)}` : status === 0 ? undefined : summarizeError(stderr, stdout);
  return {
    id: testCase.id,
    label: testCase.label,
    status,
    signal,
    durationMs: Date.now() - startedAt,
    ...(parsed.outputText ? { outputText: parsed.outputText } : {}),
    ...(parsed.usage ? { usage: parsed.usage } : {}),
    ...(error ? { error } : {}),
  };
}

function parseCodexJsonl(stdout: string): { outputText?: string; usage?: Record<string, unknown> } {
  let outputText: string | undefined;
  let usage: Record<string, unknown> | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) {
      continue;
    }
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (event.type === "item.completed") {
      const item = asRecord(event.item);
      if (item?.type === "agent_message" && typeof item.text === "string") {
        outputText = item.text;
      }
    }
    if (event.type === "turn.completed") {
      const parsedUsage = asRecord(event.usage);
      if (parsedUsage) {
        usage = parsedUsage;
      }
    }
  }
  return {
    ...(outputText ? { outputText } : {}),
    ...(usage ? { usage } : {}),
  };
}

function currentTogetherlinkBin(): string {
  const candidate = process.argv[1];
  if (candidate && existsSync(candidate)) {
    return candidate;
  }
  return "togetherlink";
}

function timeoutFromEnv(): number {
  const raw = process.env.TOGETHERLINK_CODEX_BENCH_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function formatMs(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${Math.round(value)}ms`;
}

function formatUsage(usage: Record<string, unknown>): string {
  return Object.entries(usage)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function summarizeError(stderr: string, stdout: string): string {
  const text = [stderr, stdout].join("\n").replaceAll(/\s+/g, " ").trim();
  return text.slice(0, 500) || "process exited non-zero";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}
