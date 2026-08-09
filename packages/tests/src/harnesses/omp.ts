import { DEFAULT_MODEL } from "@togetherlink/models";
import { assert, assertCommandExists } from "../assert.js";
import { runCommand } from "../command.js";
import { asRecord, jsonLines } from "../json-lines.js";
import type { Scenario } from "../types.js";

export function ompScenarios(): Scenario[] {
  return [
    {
      name: "omp: basic streaming json response with cost",
      run: async (context) => {
        assertCommandExists("omp");
        const result = await runCommand(
          context,
          "omp-basic-json",
          process.execPath,
          [
            context.cliBin,
            "omp",
            "--",
            "--mode",
            "json",
            "--no-tools",
            "--no-session",
            "-p",
            "Reply with exactly: hi",
          ],
          { timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const events = ompEvents(result.stdout);
        assert(
          events.some((event) => event.type === "session"),
          "missing session event",
        );
        assert(
          events.some(
            (event) =>
              event.type === "message_update" &&
              asRecord(event.assistantMessageEvent).type === "text_delta",
          ),
          "missing streamed text delta",
        );
        assert(
          ompAssistantText(events).some((text) => /\bhi\b/i.test(text)),
          "missing expected text",
        );
        const finalMessage = finalAssistantMessage(events);
        const usage = asRecord(finalMessage.usage);
        assert(asNumber(usage.totalTokens) > 0, "missing token usage");
        assert(asNumber(asRecord(usage.cost).total) > 0, "missing cost total");
        assert(finalMessage.provider === "together", "missing together provider marker");
        assert(finalMessage.model === DEFAULT_MODEL.id, "missing selected default model marker");
      },
    },
    {
      name: "omp: bash tool call with cost",
      run: async (context) => {
        const result = await runCommand(
          context,
          "omp-tool-pwd",
          process.execPath,
          [
            context.cliBin,
            "omp",
            "--",
            "--mode",
            "json",
            "--no-session",
            "-p",
            "Run pwd and answer with the directory only.",
          ],
          { timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const events = ompEvents(result.stdout);
        assert(
          events.some(
            (event) => event.type === "tool_execution_start" && event.toolName === "bash",
          ),
          "missing bash tool execution start",
        );
        assert(
          events.some(
            (event) =>
              event.type === "tool_execution_end" &&
              event.toolName === "bash" &&
              event.isError === false,
          ),
          "missing successful bash tool execution end",
        );
        assert(result.stdout.includes(context.repoRoot), "expected pwd result in output");
        const usage = asRecord(finalAssistantMessage(events).usage);
        assert(asNumber(usage.totalTokens) > 0, "missing token usage after tool call");
        assert(asNumber(asRecord(usage.cost).total) > 0, "missing cost total after tool call");
      },
    },
  ];
}

function ompEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

function ompAssistantText(events: Array<Record<string, unknown>>): string[] {
  return events
    .map((event) => asRecord(event.message))
    .filter((message) => message.role === "assistant")
    .flatMap((message) => (Array.isArray(message.content) ? message.content.map(asRecord) : []))
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""));
}

function finalAssistantMessage(events: Array<Record<string, unknown>>): Record<string, unknown> {
  const messages = events
    .map((event) => asRecord(event.message))
    .filter((message) => message.role === "assistant" && message.usage);
  const message = messages.at(-1);
  assert(message, "missing assistant usage");
  return message;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
