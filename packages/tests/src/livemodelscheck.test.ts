import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, test } from "vitest";
import { CODEX_SUPPORTED_MODELS } from "../../cli/src/lib/codex/defaults.js";
import { CLAUDE_SUPPORTED_MODELS } from "../../cli/src/lib/claude/defaults.js";
import { assert, assertCommandExists } from "./assert.js";
import { runCommand } from "./command.js";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { asRecord, jsonLines, parseLastJsonObject } from "./json-lines.js";
import type { TestContext } from "./types.js";

type MatrixModel = {
  id: string;
  name: string;
  selector: string;
};

type Harness = "claude" | "codex";
type Probe = "hello" | "tool" | "subagent";

type LiveModelCase = {
  harness: Harness;
  model: MatrixModel;
  probe: Probe;
  name: string;
};

const maybeDescribe = process.env.TOGETHERLINK_LIVE_MODELS_CHECK === "1" ? describe : describe.skip;

maybeDescribe("live models check for Claude and Codex", () => {
  let context: TestContext;

  beforeAll(async () => {
    assertCommandExists("claude");
    assertCommandExists("codex");
    context = await createTestContext();
    await resetTmpDir(context);
    await removePreviousLiveModelArtifacts(context);
    await stopDaemon(context, "live-models-check-daemon-stop-before");
  });

  afterAll(async () => {
    if (context) {
      await stopDaemon(context, "live-models-check-daemon-stop-after");
      await cleanupTmpDir(context);
    }
  });

  for (const check of liveModelCases()) {
    test.concurrent(check.name, async () => {
      if (check.harness === "codex" && check.probe === "hello") {
        await runCodexHello(context, check.model);
      } else if (check.harness === "codex" && check.probe === "tool") {
        await runCodexTool(context, check.model);
      } else if (check.harness === "codex" && check.probe === "subagent") {
        await runCodexSubagent(context, check.model);
      } else if (check.harness === "claude" && check.probe === "hello") {
        await runClaudeHello(context, check.model);
      } else if (check.harness === "claude" && check.probe === "tool") {
        await runClaudeTool(context, check.model);
      } else {
        await runClaudeSubagent(context, check.model);
      }
    });
  }
});

async function runCodexHello(context: TestContext, model: MatrixModel): Promise<void> {
  const helloToken = tokenFor("CODEX_HELLO", model);
  const hello = await runCodex(context, model, `Reply with exactly: ${helloToken}`, "hello");
  assert(hello.status === 0, `hello exit ${hello.status}`);
  assert(codexAgentText(hello.stdout).some((text) => text.includes(helloToken)), `missing ${helloToken}`);
}

async function runCodexTool(context: TestContext, model: MatrixModel): Promise<void> {
  const toolToken = tokenFor("CODEX_TOOL", model);
  const toolProbe = await writeProbeFile(context, "codex", model, "tool", toolToken);
  const tool = await runCodex(
    context,
    model,
    [
      "Use a shell command to read this file:",
      toolProbe,
      "Answer with exactly the file contents and nothing else.",
    ].join(" "),
    "tool",
  );
  assert(tool.status === 0, `tool exit ${tool.status}`);
  assert(tool.stdout.includes(toolToken), `missing ${toolToken}`);
  assert(codexEvents(tool.stdout).some(isCodexCommandExecution), "missing Codex command execution item");
}

async function runCodexSubagent(context: TestContext, model: MatrixModel): Promise<void> {
  const subagentToken = tokenFor("CODEX_SUBAGENT", model);
  const subagent = await runCodex(
    context,
    model,
    [
      "Delegate exactly once to a subagent using the available spawn-agent/subagent tool.",
      `The subagent task is: reply with exactly ${subagentToken}.`,
      `After it returns, reply with exactly ${subagentToken}.`,
    ].join(" "),
    "subagent",
    300_000,
  );
  assert(subagent.status === 0, `subagent exit ${subagent.status}`);
  assert(subagent.stdout.includes(subagentToken), `missing ${subagentToken}`);
  assert(hasToolName(codexEvents(subagent.stdout), ["multi_agent_v1__spawn_agent", "spawn_agent"]), "missing Codex subagent tool use");
}

async function runClaudeHello(context: TestContext, model: MatrixModel): Promise<void> {
  const helloToken = tokenFor("CLAUDE_HELLO", model);
  const hello = await runClaudeJson(context, model, `Reply with exactly: ${helloToken}`, "hello");
  assert(hello.status === 0, `hello exit ${hello.status}`);
  const parsed = parseLastJsonObject(hello.stdout);
  assert(parsed?.is_error === false, "is_error should be false");
  assert(String(parsed?.result ?? "").includes(helloToken), `missing ${helloToken}`);
}

async function runClaudeTool(context: TestContext, model: MatrixModel): Promise<void> {
  const toolToken = tokenFor("CLAUDE_TOOL", model);
  const toolProbe = await writeProbeFile(context, "claude", model, "tool", toolToken);
  const tool = await runClaudeStream(
    context,
    model,
    [
      "Use Bash to run cat on this exact file path:",
      toolProbe,
      "Answer with exactly the file contents and nothing else.",
    ].join(" "),
    "tool",
    240_000,
    ["--tools=Bash"],
  );
  assert(tool.status === 0, `tool exit ${tool.status}`);
  assert(tool.stdout.includes(toolToken), `missing ${toolToken}`);
  assert(hasToolName(jsonLines(tool.stdout), ["Bash"]), "missing Claude Bash tool use");
}

async function runClaudeSubagent(context: TestContext, model: MatrixModel): Promise<void> {
  const subagentToken = tokenFor("CLAUDE_SUBAGENT", model);
  const subagent = await runClaudeStream(
    context,
    model,
    [
      "Use the Task tool exactly once.",
      `Ask the subagent to reply with exactly ${subagentToken}.`,
      `After it returns, reply with exactly ${subagentToken}.`,
    ].join(" "),
    "subagent",
    300_000,
  );
  assert(subagent.status === 0, `subagent exit ${subagent.status}`);
  assert(subagent.stdout.includes(subagentToken), `missing ${subagentToken}`);
  assert(hasToolName(jsonLines(subagent.stdout), ["Agent", "Task"]), "missing Claude Task subagent tool use");
}

function liveModelCases(): LiveModelCase[] {
  return [
    ...modelProbeCases("codex", codexModels()),
    ...modelProbeCases("claude", claudeModels()),
  ];
}

function modelProbeCases(harness: Harness, models: MatrixModel[]): LiveModelCase[] {
  return models.flatMap((model) => (["hello", "tool", "subagent"] as const).map((probe) => ({
    harness,
    model,
    probe,
    name: `${harness}: ${probe}: ${model.name} (${model.id})`,
  })));
}

function codexModels(): MatrixModel[] {
  return CODEX_SUPPORTED_MODELS.map((model) => ({
    id: model.id,
    name: model.definition.name,
    selector: model.id,
  }));
}

function claudeModels(): MatrixModel[] {
  return CLAUDE_SUPPORTED_MODELS.map((model) => ({
    id: model.definition.id,
    name: model.definition.name,
    selector: model.alias,
  }));
}

async function runCodex(
  context: TestContext,
  model: MatrixModel,
  prompt: string,
  kind: string,
  timeoutMs = 180_000,
) {
  return runCommand(context, artifactName("codex", kind, model), process.execPath, [
    context.cliBin,
    "--main",
    model.selector,
    "codex",
    "--",
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    prompt,
  ], { timeoutMs });
}

async function runClaudeJson(
  context: TestContext,
  model: MatrixModel,
  prompt: string,
  kind: string,
  timeoutMs = 180_000,
) {
  return runCommand(context, artifactName("claude", kind, model), process.execPath, [
    context.cliBin,
    "--main",
    model.selector,
    "claude",
    "--",
    "--print",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--permission-mode",
    "bypassPermissions",
    prompt,
  ], { timeoutMs });
}

async function runClaudeStream(
  context: TestContext,
  model: MatrixModel,
  prompt: string,
  kind: string,
  timeoutMs = 240_000,
  claudeArgs: string[] = [],
) {
  return runCommand(context, artifactName("claude", kind, model), process.execPath, [
    context.cliBin,
    "--main",
    model.selector,
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
    ...claudeArgs,
    prompt,
  ], { timeoutMs });
}

async function stopDaemon(context: TestContext, artifactName: string): Promise<void> {
  await runCommand(context, artifactName, process.execPath, [
    context.cliBin,
    "daemon",
    "stop",
  ], { timeoutMs: 20_000 });
}

function codexEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

function codexAgentText(eventsText: string): string[] {
  return codexEvents(eventsText)
    .filter((event) => event.type === "item.completed" && asRecord(event.item).type === "agent_message")
    .map((event) => String(asRecord(event.item).text ?? ""));
}

function isCodexCommandExecution(event: Record<string, unknown>): boolean {
  return event.type === "item.completed" && asRecord(event.item).type === "command_execution";
}

function hasToolName(values: unknown[], names: readonly string[]): boolean {
  return values.some((value) => hasToolNameInValue(value, new Set(names)));
}

function hasToolNameInValue(value: unknown, names: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => hasToolNameInValue(entry, names));
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = asRecord(value);
  const name = record.name;
  const tool = record.tool;
  const type = record.type;
  const subtype = record.subtype;
  if (typeof name === "string" && names.has(name) && (type === "tool_use" || type === "function_call" || type === "custom_tool_call" || type === undefined)) {
    return true;
  }
  if (typeof tool === "string" && names.has(tool) && (type === "collab_tool_call" || type === undefined)) {
    return true;
  }
  if (subtype === "task_started" && (names.has("Task") || names.has("Agent"))) {
    return true;
  }
  return Object.values(record).some((entry) => hasToolNameInValue(entry, names));
}

async function writeProbeFile(
  context: TestContext,
  harness: Harness,
  model: MatrixModel,
  kind: string,
  contents: string,
): Promise<string> {
  const dir = path.join(context.tmpDir, "live-models-check");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${harness}-${kind}-${safeSlug(model.id)}.txt`);
  await writeFile(filePath, `${contents}\n`, "utf8");
  return filePath;
}

async function removePreviousLiveModelArtifacts(context: TestContext): Promise<void> {
  const files = await readdir(context.artifactsDir).catch(() => []);
  await Promise.all(files
    .filter((file) => file.includes("live-models-check"))
    .map((file) => rm(path.join(context.artifactsDir, file), { force: true })));
}

function tokenFor(prefix: string, model: MatrixModel): string {
  return `${prefix}_${safeSlug(model.id).toUpperCase()}`;
}

function artifactName(harness: "claude" | "codex", kind: string, model: MatrixModel): string {
  return `${harness}-live-models-check-${kind}-${safeSlug(model.id)}`;
}

function safeSlug(value: string): string {
  return value.replaceAll(/[^a-z0-9]+/gi, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}
