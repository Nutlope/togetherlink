import { copyFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { assertCommandExists } from "./assert.js";
import { runCommand } from "./command.js";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { asRecord, jsonLines } from "./json-lines.js";
import type { CommandResult, TestContext } from "./types.js";

const maybeDescribe = process.env.TOGETHERLINK_LIVE_CODEX_RESUME === "1" ? describe : describe.skip;

maybeDescribe("live Codex cross-provider resume", () => {
  let context: TestContext;
  let codexHome: string;

  beforeAll(async () => {
    assertCommandExists("codex");
    context = await createTestContext();
    await resetTmpDir(context);
    codexHome = path.join(context.tmpDir, "codex-home");
    await mkdir(codexHome, { recursive: true });
    await copyFile(
      path.join(os.homedir(), ".codex", "auth.json"),
      path.join(codexHome, "auth.json"),
    );
  });

  afterAll(async () => {
    if (context) {
      await cleanupTmpDir(context);
    }
  });

  test("normal Codex → tcodex → normal Codex preserves reasoning and local actions", async () => {
    const cwd = path.join(context.tmpDir, "normal-together-normal");
    await mkdir(cwd, { recursive: true });
    const normalMarker = "NORMAL_ACTION_5261";
    const togetherMarker = "TOGETHER_ACTION_9047";

    const normalStart = await runNormalCodex(
      context,
      codexHome,
      cwd,
      "resume-normal-start",
      persistentExecArgs(
        `Use apply_patch to create normal-action.txt containing exactly ${normalMarker} followed by a newline. Then reply exactly: NORMAL_CODEX_CREATED`,
      ),
    );
    expect(normalStart.status).toBe(0);
    expect(itemTypes(normalStart)).toContain("file_change");
    const threadId = startedThreadId(normalStart);

    const togetherResume = await runTogetherCodex(
      context,
      codexHome,
      cwd,
      "resume-together-middle",
      persistentResumeArgs(
        threadId,
        `Use a shell command to read normal-action.txt. Then use apply_patch to create together-action.txt containing exactly ${togetherMarker} followed by a newline. Reply exactly: ${normalMarker} ${togetherMarker}`,
      ),
    );
    expect(togetherResume.status).toBe(0);
    expect(startedThreadId(togetherResume)).toBe(threadId);
    expect(itemTypes(togetherResume)).toEqual(
      expect.arrayContaining(["command_execution", "file_change"]),
    );
    expect(togetherResume.stdout).toContain(`${normalMarker} ${togetherMarker}`);

    const normalResume = await runNormalCodex(
      context,
      codexHome,
      cwd,
      "resume-normal-finish",
      persistentResumeArgs(
        threadId,
        "Use a shell command to read normal-action.txt and together-action.txt. Reply exactly with their two marker lines separated by one space.",
      ),
    );
    expect(normalResume.status).toBe(0);
    expect(startedThreadId(normalResume)).toBe(threadId);
    expect(itemTypes(normalResume)).toContain("command_execution");
    expect(normalResume.stdout).toContain(`${normalMarker} ${togetherMarker}`);
    expect(normalResume.stdout + normalResume.stderr).not.toContain("array_above_max_length");
  });

  test("tcodex → normal Codex → tcodex preserves shell and patch history", async () => {
    const cwd = path.join(context.tmpDir, "together-normal-together");
    await mkdir(cwd, { recursive: true });
    const togetherMarker = "TOGETHER_ORIGIN_3185";
    const normalMarker = "NORMAL_RESUMED_7724";

    const togetherStart = await runTogetherCodex(
      context,
      codexHome,
      cwd,
      "reverse-together-start",
      persistentExecArgs(
        `Use a shell command with printf to create shared-action.txt containing exactly ${togetherMarker} followed by a newline. Then reply exactly: TOGETHER_CODEX_CREATED`,
      ),
    );
    expect(togetherStart.status).toBe(0);
    expect(itemTypes(togetherStart)).toContain("command_execution");
    const threadId = startedThreadId(togetherStart);

    const normalResume = await runNormalCodex(
      context,
      codexHome,
      cwd,
      "reverse-normal-middle",
      persistentResumeArgs(
        threadId,
        `Use a shell command to read shared-action.txt. Then use apply_patch to append ${normalMarker} on its own line. Reply exactly: ${togetherMarker} ${normalMarker}`,
      ),
    );
    expect(normalResume.status).toBe(0);
    expect(startedThreadId(normalResume)).toBe(threadId);
    expect(itemTypes(normalResume)).toEqual(
      expect.arrayContaining(["command_execution", "file_change"]),
    );
    expect(normalResume.stdout).toContain(`${togetherMarker} ${normalMarker}`);
    expect(normalResume.stdout + normalResume.stderr).not.toContain("array_above_max_length");

    const togetherResume = await runTogetherCodex(
      context,
      codexHome,
      cwd,
      "reverse-together-finish",
      persistentResumeArgs(
        threadId,
        "Use a shell command to read shared-action.txt. Reply exactly with its two marker lines separated by one space.",
      ),
    );
    expect(togetherResume.status).toBe(0);
    expect(startedThreadId(togetherResume)).toBe(threadId);
    expect(itemTypes(togetherResume)).toContain("command_execution");
    expect(togetherResume.stdout).toContain(`${togetherMarker} ${normalMarker}`);
  });

  test.todo(
    "normal Codex resume picker lists TogetherLink provider sessions (blocked by openai/codex#19318)",
  );
});

function persistentExecArgs(prompt: string): string[] {
  return [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "--dangerously-bypass-approvals-and-sandbox",
    prompt,
  ];
}

function persistentResumeArgs(threadId: string, prompt: string): string[] {
  return [
    "exec",
    "resume",
    threadId,
    "--json",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "--dangerously-bypass-approvals-and-sandbox",
    prompt,
  ];
}

async function runNormalCodex(
  context: TestContext,
  codexHome: string,
  cwd: string,
  name: string,
  args: string[],
): Promise<CommandResult> {
  return runCommand(context, name, "codex", args, {
    cwd,
    timeoutMs: 240_000,
    env: { CODEX_HOME: codexHome },
  });
}

async function runTogetherCodex(
  context: TestContext,
  codexHome: string,
  cwd: string,
  name: string,
  args: string[],
): Promise<CommandResult> {
  return runCommand(context, name, process.execPath, [context.cliBin, "codex", "--", ...args], {
    cwd,
    timeoutMs: 240_000,
    env: { CODEX_HOME: codexHome },
  });
}

function events(result: CommandResult): Array<Record<string, unknown>> {
  return jsonLines(result.stdout).map(asRecord);
}

function startedThreadId(result: CommandResult): string {
  const id = events(result).find((event) => event.type === "thread.started")?.thread_id;
  expect(typeof id).toBe("string");
  return String(id);
}

function itemTypes(result: CommandResult): string[] {
  return events(result)
    .filter((event) => event.type === "item.completed")
    .map((event) => String(asRecord(event.item).type ?? ""));
}
