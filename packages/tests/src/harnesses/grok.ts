import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { GLM_5_2, SELECTABLE_MODELS } from "@togetherlink/models";
import { assert, assertCommandExists } from "../assert.js";
import { runCommand } from "../command.js";
import { asRecord, jsonLines } from "../json-lines.js";
import type { Scenario } from "../types.js";

export function grokScenarios(): Scenario[] {
  return [
    {
      name: "grok: basic streaming headless response with usage",
      run: async (context) => {
        assertCommandExists("grok");
        const home = path.join(context.tmpDir, "grok-basic-home");
        const result = await runCommand(
          context,
          "grok-basic-streaming",
          process.execPath,
          [
            context.cliBin,
            "grok",
            "--",
            "--output-format",
            "streaming-json",
            "--disable-web-search",
            "--no-memory",
            "--no-subagents",
            "--max-turns",
            "2",
            "-p",
            "Reply with exactly: hi",
          ],
          { env: { HOME: home, GROK_HOME: "" }, timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const events = grokEvents(result.stdout);
        assert(
          events.some((event) => event.type === "text"),
          "missing streamed text event",
        );
        assert(
          events.some((event) => event.type === "text" && /\bhi\b/i.test(String(event.data))),
          "missing expected text",
        );
        const end = [...events].reverse().find((event) => event.type === "end");
        assert(end, "missing end event");
        assert(asNumber(asRecord(end.usage).total_tokens) > 0, "missing token usage");
        const modelUsage = asRecord(end.modelUsage);
        assert(GLM_5_2.id in modelUsage, "missing Together model usage");
      },
    },
    {
      name: "grok: terminal tool call",
      run: async (context) => {
        const home = path.join(context.tmpDir, "grok-tool-home");
        const result = await runCommand(
          context,
          "grok-tool-pwd",
          process.execPath,
          [
            context.cliBin,
            "grok",
            "--",
            "--output-format",
            "streaming-json",
            "--always-approve",
            "--disable-web-search",
            "--no-memory",
            "--no-subagents",
            "--max-turns",
            "4",
            "-p",
            "Run pwd and answer with the directory only.",
          ],
          { env: { HOME: home, GROK_HOME: "" }, timeoutMs: 180_000 },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const streamedText = grokEvents(result.stdout)
          .filter((event) => event.type === "text")
          .map((event) => String(event.data ?? ""))
          .join("");
        assert(streamedText.includes(context.repoRoot), "expected pwd result in output");
        const sessionEvents = await readSessionEvents(path.join(home, ".grok", "sessions"));
        assert(sessionEvents.includes("run_terminal_command"), "missing terminal tool event");
        assert(sessionEvents.includes('"outcome":"success"'), "missing successful tool outcome");
      },
    },
    {
      name: "grok: Together identity rule",
      run: async (context) => {
        const result = await runCommand(
          context,
          "grok-together-identity",
          process.execPath,
          [
            context.cliBin,
            "grok",
            "--",
            "--output-format",
            "streaming-json",
            "--disable-web-search",
            "--no-memory",
            "--no-subagents",
            "--max-turns",
            "1",
            "-p",
            "In one short sentence, identify who built you and which model provider is serving this session.",
          ],
          {
            env: { HOME: path.join(context.tmpDir, "grok-identity-home"), GROK_HOME: "" },
            timeoutMs: 180_000,
          },
        );
        assert(result.status === 0, `exit ${result.status}`);
        const streamedText = grokEvents(result.stdout)
          .filter((event) => event.type === "text")
          .map((event) => String(event.data ?? ""))
          .join("");
        assert(/Together AI/i.test(streamedText), "missing Together AI identity");
        assert(!claimsXaiIdentity(streamedText), "incorrectly claimed xAI model identity");
      },
    },
    {
      name: "grok: curated Together model catalog",
      run: async (context) => {
        const result = await runCommand(
          context,
          "grok-model-list",
          process.execPath,
          [context.cliBin, "grok", "--", "models"],
          {
            env: { HOME: path.join(context.tmpDir, "grok-models-home"), GROK_HOME: "" },
            timeoutMs: 60_000,
          },
        );
        assert(result.status === 0, `exit ${result.status}`);
        for (const model of SELECTABLE_MODELS) {
          assert(result.stdout.includes(model.id), `missing ${model.id}`);
        }
      },
    },
  ];
}

export function claimsXaiIdentity(text: string): boolean {
  const withoutExplicitDenials = text
    .replace(/\bnot\s+(?:an?\s+)?xAI(?:\s+model)?\b/gi, "")
    .replace(
      /\b(?:am|is|are|was|were)(?:n't|\s+not)\s+(?:built|made|developed)\s+by\s+xAI\b/gi,
      "",
    );
  return /\bxAI\b/i.test(withoutExplicitDenials);
}

function grokEvents(stdout: string): Array<Record<string, unknown>> {
  return jsonLines(stdout).map(asRecord);
}

async function readSessionEvents(root: string): Promise<string> {
  const files = await filesNamed(root, "events.jsonl");
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

async function filesNamed(root: string, fileName: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const matches: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...(await filesNamed(entryPath, fileName)));
    if (entry.isFile() && entry.name === fileName) matches.push(entryPath);
  }
  return matches;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
