#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");

const options = parseArgs(process.argv.slice(2));
const source = await readFile(options.events, "utf8");
const task = options.task ? await readFile(options.task, "utf8") : "";
const reconstruction = reconstructHistory(source, task);
const translator = await import(
  pathToFileURL(
    path.join(options.translatorRepo, "packages/cli/dist/lib/claude/translate-request.js"),
  ).href
);
const translated = translator.toOpenAIMessages({
  model: "together-glm-5-2",
  max_tokens: 32_000,
  messages: reconstruction.messages,
});
const withoutHistoricalThinking = translated.flatMap(
  ({ reasoning_content: _reasoning, ...message }) =>
    message.role === "assistant" && message.content == null && !message.tool_calls?.length
      ? []
      : [message],
);

console.log(
  JSON.stringify(
    {
      source: {
        events: options.events,
        translatorRepo: options.translatorRepo,
        sha256: createHash("sha256").update(source).digest("hex"),
        stoppedAtFirstCompaction: reconstruction.compaction !== null,
        compaction: reconstruction.compaction,
      },
      history: {
        anthropicMessages: reconstruction.messages.length,
        thinkingBlocks: reconstruction.thinkingBlocks,
        thinkingChars: reconstruction.thinkingChars,
        assistantTextChars: reconstruction.assistantTextChars,
        toolResultChars: reconstruction.toolResultChars,
      },
      currentTranslation: translationMetrics(translated),
      projectedWithoutHistoricalThinking: translationMetrics(withoutHistoricalThinking),
    },
    null,
    2,
  ),
);

function parseArgs(args) {
  let events = "";
  let task = "";
  let translatorRepo = REPO_ROOT;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--events") {
      events = path.resolve(args[(index += 1)] ?? "");
    } else if (arg === "--task") {
      task = path.resolve(args[(index += 1)] ?? "");
    } else if (arg === "--translator-repo") {
      translatorRepo = path.resolve(args[(index += 1)] ?? "");
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node analyze-claude-history-replay.mjs --events CLAUDE_EVENTS.jsonl [--task TASK.md] [--translator-repo REPO]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!events) {
    throw new Error("--events is required");
  }
  return { events, task, translatorRepo };
}

function reconstructHistory(source, task) {
  const messages = [];
  const assistantById = new Map();
  let compaction = null;
  let thinkingBlocks = 0;
  let thinkingChars = 0;
  let assistantTextChars = 0;
  let toolResultChars = 0;

  if (task.trim()) {
    messages.push({ role: "user", content: task });
  }

  for (const line of source.split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "system" && event.subtype === "compact_boundary") {
      compaction = event.compact_metadata ?? {};
      break;
    }
    if (event.type === "assistant" && event.message?.role === "assistant") {
      const id = String(event.message.id ?? event.uuid ?? `assistant-${messages.length}`);
      let message = assistantById.get(id);
      if (!message) {
        message = { role: "assistant", content: [] };
        assistantById.set(id, message);
        messages.push(message);
      }
      const blocks = Array.isArray(event.message.content) ? event.message.content : [];
      for (const block of blocks) {
        message.content.push(block);
        if (block?.type === "thinking") {
          thinkingBlocks += 1;
          thinkingChars += String(block.thinking ?? "").length;
        } else if (block?.type === "redacted_thinking") {
          thinkingBlocks += 1;
          thinkingChars += String(block.data ?? "").length;
        } else if (block?.type === "text") {
          assistantTextChars += String(block.text ?? "").length;
        }
      }
      continue;
    }
    if (event.type === "user" && event.message?.role === "user") {
      const content = event.message.content;
      messages.push({ role: "user", content });
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "tool_result") {
            toolResultChars += JSON.stringify(block.content ?? "").length;
          }
        }
      }
    }
  }

  return {
    messages,
    compaction,
    thinkingBlocks,
    thinkingChars,
    assistantTextChars,
    toolResultChars,
  };
}

function translationMetrics(messages) {
  const json = JSON.stringify({ messages });
  const reasoning = messages.flatMap((message) =>
    typeof message.reasoning_content === "string" ? [message.reasoning_content] : [],
  );
  const reasoningOnlyMessages = messages.filter(
    (message) =>
      typeof message.reasoning_content === "string" &&
      message.content == null &&
      !message.tool_calls?.length,
  ).length;
  return {
    messages: messages.length,
    payloadBytes: Buffer.byteLength(json),
    reasoningMessages: reasoning.length,
    reasoningOnlyMessages,
    reasoningChars: reasoning.reduce((total, value) => total + value.length, 0),
    sha256: createHash("sha256").update(json).digest("hex"),
  };
}
