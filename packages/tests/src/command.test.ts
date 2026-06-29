import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runCommand } from "./command.js";
import type { TestContext } from "./types.js";

describe("runCommand", () => {
  let tmpDir: string;
  let context: TestContext;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "togetherlink-command-"));
    context = {
      repoRoot: tmpDir,
      cliBin: process.execPath,
      artifactsDir: tmpDir,
      tmpDir,
      results: [],
    };
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("passes large prompt bodies over stdin instead of argv", async () => {
    const payload = `${"x".repeat(300_000)}FINAL_TOKEN`;
    const result = await runCommand(context, "stdin-large-prompt", process.execPath, [
      "-e",
      "let data=''; process.stdin.on('data', c => data += c); process.stdin.on('end', () => console.log(data.slice(-11)));",
    ], { stdin: payload });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("FINAL_TOKEN");
    expect(result.args.join("")).not.toContain("FINAL_TOKEN");
  });
});
