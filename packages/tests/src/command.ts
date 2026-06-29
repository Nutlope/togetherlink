import { type ChildProcess, spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { CommandResult, TestContext } from "./types.js";

export async function runCommand(
  context: TestContext,
  name: string,
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; stdin?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CommandResult> {
  const cwd = options.cwd ?? context.repoRoot;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...options.env,
      TOGETHERLINK_DEBUG: "1",
      CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
      DISABLE_FEEDBACK_COMMAND: "1",
    },
    stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (options.stdin !== undefined) {
    if (!child.stdin) {
      throw new Error("stdin pipe was not available");
    }
    child.stdin.end(options.stdin);
  }

  let stdout = "";
  let stderr = "";
  if (!child.stdout || !child.stderr) {
    throw new Error("stdout/stderr pipes were not available");
  }
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  let timedOut = false;
  let killTimer: NodeJS.Timeout | undefined;
  const timeout = setTimeout(() => {
    timedOut = true;
    signalChildTree(child, "SIGTERM");
    killTimer = setTimeout(() => signalChildTree(child, "SIGKILL"), 5_000);
  }, timeoutMs);
  const status = await new Promise<number>((resolve) => {
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
  clearTimeout(timeout);
  if (killTimer) {
    clearTimeout(killTimer);
  }

  const artifact: CommandResult = { name, command, args, cwd, status, timedOut, stdout, stderr };
  await writeArtifact(context, `${safeName(name)}.json`, artifact);
  return artifact;
}

export async function writeArtifact(context: TestContext, fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(context.artifactsDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}

function signalChildTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      child.kill(signal);
      return;
    }
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process may already have exited.
    }
  }
}
