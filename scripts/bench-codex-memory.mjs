#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
const capturePath = args.capture ?? "/tmp/codex-memory-capture.jsonl";
const models = (args.models ?? process.env.TOGETHERLINK_CODEX_MEMORY_BENCH_MODELS ?? "MiniMaxAI/MiniMax-M3,Qwen/Qwen3.5-9B")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const maxTokens = Number.parseInt(args.maxTokens ?? "1200", 10);
const maxInputChars = args.maxInputChars ? Number.parseInt(args.maxInputChars, 10) : undefined;
const printContent = args.printContent === "1" || args.printContent === "true";
const stream = args.stream === "1" || args.stream === "true";
const timeoutMs = args.timeoutMs ? Number.parseInt(args.timeoutMs, 10) : 120_000;

const apiKey = loadTogetherApiKey();
if (!apiKey) {
  throw new Error("No Together API key found. Export TOGETHER_API_KEY or run `togetherlink configure`.");
}

const request = readMemoryRequest(capturePath);
const fullInputText = request.input?.[0]?.content?.map((part) => part.text || "").join("\n") || "";
const inputText = maxInputChars ? fullInputText.slice(0, maxInputChars) : fullInputText;
const schemaFormat = request.text?.format;
if (!schemaFormat?.schema) {
  throw new Error("Captured memory request did not include a Responses text.format JSON schema.");
}

console.log(
  JSON.stringify(
    {
      capturePath,
      capturedModel: request.model,
      instructionChars: request.instructions?.length ?? 0,
      inputChars: inputText.length,
      truncated: inputText.length !== fullInputText.length,
      promptHash: createHash("sha256").update(`${request.instructions ?? ""}\n${inputText}`).digest("hex").slice(0, 12),
      schemaName: schemaFormat.name,
      models,
    },
    null,
    2,
  ),
);

for (const model of models) {
  const started = Date.now();
  const result = await callTogether(model, request, inputText, schemaFormat, maxTokens, apiKey, { stream, timeoutMs });
  const ms = Date.now() - started;
  const content = result.content ?? result.json?.choices?.[0]?.message?.content ?? "";
  const reasoning = result.reasoning ?? result.json?.choices?.[0]?.message?.reasoning ?? result.json?.choices?.[0]?.message?.reasoning_content ?? "";
  const parsed = parseJson(content);
  const fields = parsed && typeof parsed === "object" ? parsed : undefined;
  const report = {
    model,
    status: result.status,
    ms,
    usage: result.json?.usage,
    stream,
    error: result.json?.error?.message || (!result.ok ? result.text.slice(0, 500) : undefined),
    contentChars: content.length,
    reasoningChars: reasoning.length,
    validJson: Boolean(fields),
    requiredKeysPresent: fields ? ["rollout_summary", "rollout_slug", "raw_memory"].every((key) => key in fields) : false,
    fieldLengths: fields
      ? Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [
            key,
            typeof value === "string" ? value.length : value === null ? 0 : JSON.stringify(value).length,
          ]),
        )
      : undefined,
    ...(printContent ? { content } : {}),
  };
  console.log(`\n${JSON.stringify(report, null, 2)}`);
}

function parseArgs(raw) {
  const parsed = {};
  for (let i = 0; i < raw.length; i += 1) {
    const arg = raw[i];
    if (!arg?.startsWith("--")) {
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      parsed[toCamel(arg.slice(2, eq))] = arg.slice(eq + 1);
      continue;
    }
    parsed[toCamel(arg.slice(2))] = raw[i + 1] && !raw[i + 1].startsWith("--") ? raw[++i] : "true";
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function loadTogetherApiKey() {
  if (process.env.TOGETHER_API_KEY?.trim()) {
    return process.env.TOGETHER_API_KEY.trim();
  }
  const configPath = path.join(homedir(), ".togetherlink", "config.json");
  if (!existsSync(configPath)) {
    return "";
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  return config.apiKey && config.apiKey !== "{env:TOGETHER_API_KEY}" ? config.apiKey : "";
}

function readMemoryRequest(filePath) {
  const lines = readFileSync(filePath, "utf8").trim().split(/\n/).filter(Boolean).map((line) => JSON.parse(line));
  const memory = lines.find((line) => line.body?.model === "gpt-5.4-mini" || line.body?.instructions?.includes("## Memory Writing Agent:"));
  if (!memory?.body) {
    throw new Error(`No Codex memory request found in ${filePath}.`);
  }
  return memory.body;
}

async function callTogether(model, request, inputText, schemaFormat, maxTokens, apiKey, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const payload = {
    model,
    messages: [
      { role: "system", content: "You are running inside Codex through togetherlink. Produce only the requested structured output." },
      { role: "system", content: request.instructions ?? "" },
      { role: "user", content: inputText },
    ],
    max_tokens: maxTokens,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaFormat.name ?? "codex_output_schema",
        schema: schemaFormat.schema,
        strict: schemaFormat.strict ?? true,
      },
    },
    ...(options.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
  };
  try {
    const response = await fetch("https://api.together.ai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!options.stream || !response.ok) {
      const text = await response.text();
      return { ok: response.ok, status: response.status, text, json: parseJson(text) };
    }
    const streamed = await readChatStream(response);
    return { ok: response.ok, status: response.status, text: streamed.content, content: streamed.content, reasoning: streamed.reasoning, json: { usage: streamed.usage } };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: err instanceof Error && err.name === "AbortError" ? `timed out after ${options.timeoutMs}ms` : String(err),
      json: undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function readChatStream(response) {
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let usage;
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");
      if (data && data !== "[DONE]") {
        const parsed = parseJson(data);
        usage ||= parsed?.usage;
        const delta = parsed?.choices?.[0]?.delta;
        content += delta?.content ?? "";
        reasoning += delta?.reasoning ?? delta?.reasoning_content ?? "";
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  return { content, reasoning, usage };
}
