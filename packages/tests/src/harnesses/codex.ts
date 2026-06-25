import { readFile } from "node:fs/promises";
import path from "node:path";
import { assert, assertCommandExists, looksLikeContextError } from "../assert.js";
import { runCommand } from "../command.js";
import { codingTaskPrompt, createFixtureRepo } from "../fixture-repo.js";
import { asRecord, jsonLines } from "../json-lines.js";
import { makeLongRecords } from "../long-context.js";
import { assertCodexContextLimitRetry } from "../context-limit.js";
import type { Scenario } from "../types.js";

export function codexScenarios(): Scenario[] {
  return [
    {
      name: "codex: basic streaming headless response",
      run: async (context) => {
        assertCommandExists("codex");
        const result = await runCommand(context, "codex-basic", process.execPath, [
          context.cliBin,
          "codex",
          "--",
          "exec",
          "--json",
          "--ephemeral",
          "--skip-git-repo-check",
          "--ignore-user-config",
          "--ignore-rules",
          "Reply with exactly: hi",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const events = codexEvents(result.stdout);
        assert(events.some((event) => event.type === "turn.started"), "missing turn.started event");
        assert(events.some((event) => event.type === "turn.completed"), "missing turn.completed event");
        assert(codexAgentText(events).some((text) => /\bhi\b/i.test(text)), "missing expected agent text");
      },
    },
    {
      name: "codex: bash tool call",
      run: async (context) => {
        const result = await runCommand(context, "codex-tool-pwd", process.execPath, [
          context.cliBin,
          "codex",
          "--",
          "exec",
          "--json",
          "--ephemeral",
          "--skip-git-repo-check",
          "--ignore-user-config",
          "--ignore-rules",
          "Run pwd and answer with the directory only.",
        ], { timeoutMs: 180_000 });
        assert(result.status === 0, `exit ${result.status}`);
        assert(result.stdout.includes(context.repoRoot), "expected pwd result in output");
        assert(codexEvents(result.stdout).some((event) => event.type === "item.completed" && asRecord(event.item).type === "command_execution"), "missing command execution item");
      },
    },
    {
      name: "codex: coding task in temporary git repo",
      run: async (context) => {
        const repo = await createFixtureRepo(context, "codex");
        try {
          const result = await runCommand(context, "codex-coding-task", process.execPath, [
            context.cliBin,
            "codex",
            "--",
            "exec",
            "--json",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "workspace-write",
            "--ignore-user-config",
            "--ignore-rules",
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
      name: "codex: reasoning stream usage",
      run: async (context) => {
        const result = await runCommand(context, "codex-reasoning", process.execPath, [
          context.cliBin,
          "codex",
          "--",
          "exec",
          "--json",
          "--ephemeral",
          "--skip-git-repo-check",
          "--ignore-user-config",
          "--ignore-rules",
          "-c",
          'model_reasoning_effort="high"',
          "-c",
          'model_reasoning_summary="detailed"',
          "Think carefully, then answer in one sentence: what is 23 * 41?",
        ], { timeoutMs: 180_000 });
        assert(result.status === 0, `exit ${result.status}`);
        const completed = codexEvents(result.stdout).find((event) => event.type === "turn.completed");
        assert((asRecord(completed?.usage).reasoning_output_tokens as number | undefined ?? 0) > 0, "reasoning_output_tokens should be nonzero");
      },
    },
    {
      name: "codex: long-context pressure",
      run: async (context) => {
        const prompt = [
          "You are testing long-context handling. Read the repeated records below and answer with only the checksum token from the final record.",
          makeLongRecords(500, "CODEX_FINAL_CHECKSUM_9371"),
        ].join("\n\n");
        const result = await runCommand(context, "codex-long-context", process.execPath, [
          context.cliBin,
          "codex",
          "--",
          "exec",
          "--json",
          "--ephemeral",
          "--skip-git-repo-check",
          "--ignore-user-config",
          "--ignore-rules",
          prompt,
        ], { timeoutMs: 300_000 });
        assert(result.status === 0, `exit ${result.status}`);
        assert(result.stdout.includes("CODEX_FINAL_CHECKSUM_9371"), "missing final checksum");
        assert(!looksLikeContextError(result.stderr + result.stdout), "context-length error surfaced");
      },
    },
    {
      name: "codex: real context-limit retry",
      run: async (context) => {
        await assertCodexContextLimitRetry(context);
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

function codexEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

function codexAgentText(events: Array<Record<string, unknown>>): string[] {
  return events
    .filter((event) => event.type === "item.completed" && asRecord(event.item).type === "agent_message")
    .map((event) => String(asRecord(event.item).text ?? ""));
}
