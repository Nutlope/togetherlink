import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runCommand } from "../src/command.js";
import { cliBin } from "../src/paths.js";
import type { TestContext } from "../src/types.js";

const repoRoot = path.join(import.meta.dirname, "..", "..", "..");

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
    const result = await runCommand(
      context,
      "stdin-large-prompt",
      process.execPath,
      [
        "-e",
        "let data=''; process.stdin.on('data', c => data += c); process.stdin.on('end', () => console.log(data.slice(-11)));",
      ],
      { stdin: payload },
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("FINAL_TOKEN");
    expect(result.args.join("")).not.toContain("FINAL_TOKEN");
  });

  test("disables production telemetry for repository-run harness commands", async () => {
    const result = await runCommand(context, "telemetry-disabled", process.execPath, [
      "-e",
      "process.stdout.write(process.env.TOGETHERLINK_TELEMETRY_DISABLED ?? '')",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("1");
  });

  test("whoami prints the anonymous install id", async () => {
    const home = await mkdtemp(path.join(tmpDir, "home-"));
    const result = await runCommand(
      context,
      "whoami-install-id",
      process.execPath,
      [cliBin, "whoami"],
      {
        env: { HOME: home },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const installId = result.stdout.trim();
    expect(installId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const stored = JSON.parse(
      await readFile(path.join(home, ".togetherlink", "install-id"), "utf8"),
    ) as { id?: string };
    expect(stored.id).toBe(installId);
  });

  test("usage prints locally tracked spend for completed proxied sessions", async () => {
    const home = await mkdtemp(path.join(tmpDir, "usage-home-"));
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { createSessionStore } from "./packages/cli/dist/lib/daemon/storage.js";
          import { KIMI_K3 } from "./packages/models/dist/index.js";
          const store = await createSessionStore(process.argv[1]);
          store.upsertSession({
            token: "completed-chatgpt-session",
            agent: "codex-app",
            apiKey: "phantom-key",
            modelLabel: KIMI_K3.name,
            targetModelId: KIMI_K3.id,
            modelDefinition: KIMI_K3,
            startedAt: Date.now() - 2000,
            lastSeenAt: Date.now() - 1000,
            endedAt: Date.now(),
            costSummary: "test",
            costTotals: { promptTokens: 10, cachedTokens: 0, completionTokens: 2, costUsd: 1.5 },
            usageByModel: [{ model: KIMI_K3.id, promptTokens: 10, cachedTokens: 0, completionTokens: 2, costUsd: 1.5 }],
          });
          store.close();
        `,
        path.join(home, ".togetherlink"),
      ],
      { cwd: repoRoot },
    );

    const result = await runCommand(
      context,
      "usage-report",
      process.execPath,
      [cliBin, "usage", "--last", "7d"],
      { env: { HOME: home, TOGETHERLINK_HOME: path.join(home, ".togetherlink") } },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("TogetherLink usage · last 7 days");
    expect(result.stdout).toContain("Cost          $1.50");
    expect(result.stdout).toContain("Total tokens     12");
    expect(result.stdout).toContain("Other harnesses aren't tracked yet.");
    expect(result.stdout).toContain("Kimi K3");
    expect(result.stdout).toContain("ChatGPT Desktop");
  });
});
