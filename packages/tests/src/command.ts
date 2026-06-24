import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { CommandResult, TestContext } from "./types.js";

export async function runCommand(
  context: TestContext,
  name: string,
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CommandResult> {
  const cwd = options.cwd ?? context.repoRoot;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      TOGETHERLINK_DEBUG: "1",
      CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
      DISABLE_FEEDBACK_COMMAND: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
  const status = await new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
  clearTimeout(timeout);

  const artifact: CommandResult = { name, command, args, cwd, status, stdout, stderr };
  await writeArtifact(context, `${safeName(name)}.json`, artifact);
  return artifact;
}

export async function writeArtifact(context: TestContext, fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(context.artifactsDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}
