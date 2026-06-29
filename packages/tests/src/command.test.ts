import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runCommand } from "./command.js";
import { cliBin } from "./paths.js";
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

  test("whoami prints the anonymous install id", async () => {
    const home = await mkdtemp(path.join(tmpDir, "home-"));
    const result = await runCommand(context, "whoami-install-id", process.execPath, [cliBin, "whoami"], {
      env: { HOME: home },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const installId = result.stdout.trim();
    expect(installId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const stored = JSON.parse(await readFile(path.join(home, ".togetherlink", "install-id"), "utf8")) as { id?: string };
    expect(stored.id).toBe(installId);
  });
});
