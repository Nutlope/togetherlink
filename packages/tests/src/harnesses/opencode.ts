import { assert, assertCommandExists, looksLikeContextError } from "../assert.js";
import { runCommand } from "../command.js";
import { asRecord, jsonLines } from "../json-lines.js";
import { makeLongRecords } from "../long-context.js";
import type { Scenario } from "../types.js";

export function opencodeScenarios(): Scenario[] {
  return [
    {
      name: "opencode: basic streaming headless response",
      run: async (context) => {
        assertCommandExists("opencode");
        const result = await runCommand(context, "opencode-basic", process.execPath, [
          context.cliBin,
          "opencode",
          "--",
          "run",
          "--format",
          "json",
          "--dangerously-skip-permissions",
          "Reply with exactly: hi",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const events = openCodeEvents(result.stdout);
        assert(
          events.some((event) => event.type === "step_start"),
          "missing step_start event",
        );
        assert(
          events.some((event) => event.type === "text"),
          "missing streamed text event",
        );
        assert(
          events.some((event) => event.type === "step_finish"),
          "missing step_finish event",
        );
        assert(
          openCodeText(events).some((text) => /\bhi\b/i.test(text)),
          "missing expected text",
        );
      },
    },
    {
      name: "opencode: bash tool call",
      run: async (context) => {
        const result = await runCommand(
          context,
          "opencode-tool-pwd",
          process.execPath,
          [
            context.cliBin,
            "opencode",
            "--",
            "run",
            "--format",
            "json",
            "--dangerously-skip-permissions",
            "Run pwd and answer with the directory only.",
          ],
          { timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const events = openCodeEvents(result.stdout);
        assert(
          events.some((event) => event.type === "tool_use" && asRecord(event.part).tool === "bash"),
          "missing bash tool_use event",
        );
        assert(result.stdout.includes(context.repoRoot), "expected pwd result in output");
      },
    },
    {
      name: "opencode: long-context pressure",
      run: async (context) => {
        const prompt = [
          "You are testing long-context handling. Read the repeated records below and answer with only the checksum token from the final record.",
          makeLongRecords(250, "OPENCODE_FINAL_CHECKSUM_4185"),
        ].join("\n\n");
        const result = await runCommand(
          context,
          "opencode-long-context",
          process.execPath,
          [
            context.cliBin,
            "opencode",
            "--",
            "run",
            "--format",
            "json",
            "--dangerously-skip-permissions",
            prompt,
          ],
          { timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        assert(result.stdout.includes("OPENCODE_FINAL_CHECKSUM_4185"), "missing final checksum");
        assert(
          !looksLikeContextError(result.stderr + result.stdout),
          "context-length error surfaced",
        );
      },
    },
  ];
}

function openCodeEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

function openCodeText(events: Array<Record<string, unknown>>): string[] {
  return events
    .filter((event) => event.type === "text")
    .map((event) => String(asRecord(event.part).text ?? ""));
}
