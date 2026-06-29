import { readFile } from "node:fs/promises";
import path from "node:path";
import { assert, assertCommandExists, looksLikeContextError } from "../assert.js";
import { runCommand } from "../command.js";
import { codingTaskPrompt, createFixtureRepo } from "../fixture-repo.js";
import { asRecord, jsonLines, parseLastJsonObject } from "../json-lines.js";
import { makeLongRecords } from "../long-context.js";
import { assertClaudeContextLimitRetry } from "../context-limit.js";
import type { Scenario } from "../types.js";

export function claudeScenarios(): Scenario[] {
  return [
    {
      name: "claude: basic headless response",
      run: async (context) => {
        assertCommandExists("claude");
        const result = await runCommand(context, "claude-basic", process.execPath, [
          context.cliBin,
          "claude",
          "--",
          "--print",
          "--output-format",
          "json",
          "--no-session-persistence",
          "--permission-mode",
          "bypassPermissions",
          "Reply with exactly: hi",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const parsed = parseLastJsonObject(result.stdout);
        assert(parsed?.is_error === false, "is_error should be false");
        assert(/\bhi\b/i.test(String(parsed?.result ?? "")), "missing expected result text");
      },
    },
    {
      name: "claude: stream-json response",
      run: async (context) => {
        const result = await runCommand(context, "claude-stream-json", process.execPath, [
          context.cliBin,
          "claude",
          "--",
          "--print",
          "--verbose",
          "--output-format",
          "stream-json",
          "--include-partial-messages",
          "--no-session-persistence",
          "--permission-mode",
          "bypassPermissions",
          "Reply with exactly: hi",
        ], { timeoutMs: 180_000 });
        assert(result.status === 0, `exit ${result.status}`);
        const events = jsonLines(result.stdout).map(asRecord);
        assert(events.some((event) => event.type === "stream_event" && asRecord(event.event).type === "message_start"), "missing message_start stream event");
        assert(events.some((event) => event.type === "stream_event" && asRecord(event.event).type === "content_block_delta"), "missing content delta stream event");
        assert(events.some((event) => event.type === "result" && event.is_error === false), "missing successful stream-json result");
      },
    },
    {
      name: "claude: read tool call",
      run: async (context) => {
        const result = await runCommand(context, "claude-read", process.execPath, [
          context.cliBin,
          "claude",
          "--",
          "--print",
          "--output-format",
          "json",
          "--no-session-persistence",
          "--permission-mode",
          "bypassPermissions",
          "Read README.md and answer in one sentence what this project does.",
        ], { timeoutMs: 180_000 });
        assert(result.status === 0, `exit ${result.status}`);
        const parsed = parseLastJsonObject(result.stdout);
        assert(parsed?.is_error === false, "is_error should be false");
        assert(/Together|Claude|Codex|OpenCode|AI/i.test(String(parsed?.result ?? "")), "answer does not look README-based");
      },
    },
    {
      name: "claude: coding task in temporary git repo",
      run: async (context) => {
        const repo = await createFixtureRepo(context, "claude");
        try {
          const result = await runCommand(context, "claude-coding-task", process.execPath, [
            context.cliBin,
            "claude",
            "--",
            "--print",
            "--output-format",
            "json",
            "--no-session-persistence",
            "--permission-mode",
            "bypassPermissions",
            codingTaskPrompt(),
          ], { cwd: repo.path, timeoutMs: 300_000 });
          assert(result.status === 0, `exit ${result.status}`);
          await assertFixtureRepoSolved(repo.path);
        } finally {
          await repo.cleanup();
        }
      },
    },
    {
      name: "claude: long-context pressure",
      run: async (context) => {
        const prompt = [
          "You are testing long-context handling. Read the repeated records below and answer with only the checksum token from the final record.",
          makeLongRecords(500, "CLAUDE_FINAL_CHECKSUM_6248"),
        ].join("\n\n");
        const result = await runCommand(context, "claude-long-context", process.execPath, [
          context.cliBin,
          "claude",
          "--",
          "--print",
          "--output-format",
          "json",
          "--no-session-persistence",
          "--permission-mode",
          "bypassPermissions",
        ], { timeoutMs: 300_000, stdin: prompt });
        assert(result.status === 0, `exit ${result.status}`);
        assert(result.stdout.includes("CLAUDE_FINAL_CHECKSUM_6248"), "missing final checksum");
        assert(!looksLikeContextError(result.stderr + result.stdout), "context-length error surfaced");
      },
    },
    {
      name: "claude: real context-limit retry",
      run: async (context) => {
        await assertClaudeContextLimitRetry(context);
      },
    },
  ];
}

async function assertFixtureRepoSolved(repoPath: string): Promise<void> {
  const stats = await readFile(path.join(repoPath, "lib/stats.js"), "utf8");
  const tests = await readFile(path.join(repoPath, "test/stats.test.js"), "utf8");
  const readme = await readFile(path.join(repoPath, "README.md"), "utf8");
  assert(/export function median/.test(stats), "median export missing");
  assert(/median/.test(tests), "median tests missing");
  assert(/median\(numbers\)/.test(readme), "README median entry missing");
}
