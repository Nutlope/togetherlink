import { assert, assertCommandExists } from "../assert.js";
import { runCommand } from "../command.js";
import { asRecord, jsonLines } from "../json-lines.js";
import type { Scenario } from "../types.js";

export function piScenarios(): Scenario[] {
  return [
    {
      name: "pi: status exposes Codex-curated Together models",
      run: async (context) => {
        const result = await runCommand(context, "pi-status", process.execPath, [
          context.cliBin,
          "pi",
          "status",
          "--json",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const status = asRecord(JSON.parse(result.stdout));
        assert(status.provider === "together", "expected Together provider");
        assert(status.currentModel === "zai-org/GLM-5.2", "expected Codex default model");
        const supportedModels = String(status.supportedModels ?? "").split(",");
        for (const model of [
          "zai-org/GLM-5.2",
          "moonshotai/Kimi-K2.6",
          "moonshotai/Kimi-K2.7-Code",
          "MiniMaxAI/MiniMax-M3",
          "Qwen/Qwen3.7-Max",
          "deepseek-ai/DeepSeek-V4-Pro",
        ]) {
          assert(supportedModels.includes(model), `missing Codex-supported model ${model}`);
        }
      },
    },
    {
      name: "pi: basic streaming json response with cost",
      run: async (context) => {
        assertCommandExists("pi");
        const result = await runCommand(context, "pi-basic-json", process.execPath, [
          context.cliBin,
          "pi",
          "--",
          "--mode",
          "json",
          "--no-tools",
          "-p",
          "Reply with exactly: hi",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const events = piEvents(result.stdout);
        assert(events.some((event) => event.type === "session"), "missing session event");
        assert(events.some((event) => event.type === "message_update" && asRecord(event.assistantMessageEvent).type === "text_delta"), "missing streamed text delta");
        assert(piAssistantText(events).some((text) => /\bhi\b/i.test(text)), "missing expected text");
        const usage = finalAssistantUsage(events);
        assert(asNumber(usage.totalTokens) > 0, "missing token usage");
        assert(asNumber(asRecord(usage.cost).total) > 0, "missing cost total");
        assert(events.some((event) => asRecord(event.message).provider === "together"), "missing together provider marker");
      },
    },
    {
      name: "pi: bash tool call with cost",
      run: async (context) => {
        const result = await runCommand(context, "pi-tool-pwd", process.execPath, [
          context.cliBin,
          "pi",
          "--",
          "--mode",
          "json",
          "-p",
          "Run pwd and answer with the directory only.",
        ], { timeoutMs: 180_000 });
        assert(result.status === 0, `exit ${result.status}`);
        const events = piEvents(result.stdout);
        assert(events.some((event) => event.type === "tool_execution_start" && event.toolName === "bash"), "missing bash tool execution start");
        assert(events.some((event) => event.type === "tool_execution_end" && event.toolName === "bash" && event.isError === false), "missing successful bash tool execution end");
        assert(result.stdout.includes(context.repoRoot), "expected pwd result in output");
        const usage = finalAssistantUsage(events);
        assert(asNumber(usage.totalTokens) > 0, "missing token usage after tool call");
        assert(asNumber(asRecord(usage.cost).total) > 0, "missing cost total after tool call");
      },
    },
    {
      name: "pi: together model list includes multiple models and vision metadata",
      run: async (context) => {
        const codexModelResult = await runCommand(context, "pi-model-list-codex-default", process.execPath, [
          context.cliBin,
          "pi",
          "--",
          "--list-models",
          "GLM-5.2",
        ]);
        assert(codexModelResult.status === 0, `exit ${codexModelResult.status}`);
        assert(codexModelResult.stdout.includes("zai-org/GLM-5.2"), "missing registered Codex default model");
        assert(!codexModelResult.stderr.includes("Using custom model id"), "Codex default should be registered in Pi");

        const result = await runCommand(context, "pi-model-list", process.execPath, [
          context.cliBin,
          "pi",
          "--",
          "--list-models",
          "MiniMax",
        ]);
        assert(result.status === 0, `exit ${result.status}`);
        const lines = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("together  "));
        assert(lines.length >= 2, "expected multiple Together models");
        assert(lines.some((line) => /MiniMaxAI\/MiniMax-M3/.test(line) && /\byes\b/.test(line)), "missing vision-capable MiniMax-M3 row");
      },
    },
  ];
}

function piEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

function piAssistantText(events: Array<Record<string, unknown>>): string[] {
  return events
    .map((event) => asRecord(event.message))
    .filter((message) => message.role === "assistant")
    .flatMap((message) => Array.isArray(message.content) ? message.content.map(asRecord) : [])
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""));
}

function finalAssistantUsage(events: Array<Record<string, unknown>>): Record<string, unknown> {
  const assistantMessages = events
    .map((event) => asRecord(event.message))
    .filter((message) => message.role === "assistant" && message.usage);
  const message = assistantMessages.at(-1);
  assert(message, "missing assistant usage");
  return asRecord(message.usage);
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
