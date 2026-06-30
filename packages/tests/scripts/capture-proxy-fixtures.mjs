#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GLM_MODEL_ID = "zai-org/GLM-5.2";
const GLM_ANTHROPIC_ALIAS = "together-glm-5-2";
const GLM_NAME = "GLM 5.2";
const GLM_CONTEXT = 262_144;
const GLM_OUTPUT = 164_000;
const GLM_ANTHROPIC_CAPABILITIES =
  "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, "packages/tests/fixtures/proxy");

const options = parseArgs(process.argv.slice(2));
await mkdir(options.outDir, { recursive: true });

const results = [];
if (options.agent === "both" || options.agent === "codex") {
  results.push(await captureCodex(options.outDir));
}
if (options.agent === "both" || options.agent === "claude") {
  results.push(await captureClaude(options.outDir));
}

console.log(JSON.stringify({ ok: true, fixtures: results }, null, 2));

function parseArgs(args) {
  let agent = "both";
  let outDir = DEFAULT_OUT_DIR;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--agent") {
      agent = args[(i += 1)] ?? agent;
    } else if (arg === "--out-dir") {
      outDir = path.resolve(args[(i += 1)] ?? outDir);
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["both", "codex", "claude"].includes(agent)) {
    throw new Error(`--agent must be one of: both, codex, claude`);
  }
  return { agent, outDir };
}

function printHelpAndExit() {
  console.log(`Usage: node packages/tests/scripts/capture-proxy-fixtures.mjs [--agent both|codex|claude] [--out-dir DIR]

Runs installed Codex and/or Claude Code headlessly against a local recorder,
then saves the largest real proxy request body as a benchmark fixture.`);
  process.exit(0);
}

async function captureCodex(outDir) {
  assertCommandExists("codex");
  const repo = await createFixtureRepo("codex");
  const runtimeHome = await createRuntimeHome("codex");
  const recorder = await startCodexRecorder();
  try {
    const catalogPath = path.join(repo.path, "codex-models.json");
    await writeFile(catalogPath, JSON.stringify(await loadCodexCatalog(), null, 2), "utf8");
    const args = [
      "exec",
      "--json",
      "--ephemeral",
      "--skip-git-repo-check",
      "--ignore-user-config",
      "--ignore-rules",
      "--dangerously-bypass-approvals-and-sandbox",
      "-c",
      'model_provider="capture"',
      "-c",
      `model="${GLM_MODEL_ID}"`,
      "-c",
      `model_catalog_json="${catalogPath}"`,
      "-c",
      'model_providers.capture.name="Capture"',
      "-c",
      `model_providers.capture.base_url="${recorder.url}/v1"`,
      "-c",
      'model_providers.capture.wire_api="responses"',
      "-c",
      'model_providers.capture.env_key="TOGETHERLINK_CODEX_AUTH_TOKEN"',
      codingPrompt(),
    ];
    const result = await runCommand("codex", args, {
      cwd: repo.path,
      env: {
        ...isolatedHomeEnv(runtimeHome.path),
        TOGETHERLINK_CODEX_AUTH_TOKEN: "local-token",
      },
      timeoutMs: 45_000,
    });
    const capture = largestCapture(recorder.captures, "/v1/responses");
    if (!capture) {
      throw new Error(`Codex produced no /v1/responses request. stderr: ${result.stderr}`);
    }
    const payload = sanitizePayload(capture.body, [repo.path, runtimeHome.path]);
    const file = path.join(outDir, "codex-headless-coding-session.responses.json");
    await writePayload(file, payload);
    return fixtureResult("codex", file, payload, result, recorder.captures.length);
  } finally {
    await recorder.close();
    await runtimeHome.cleanup();
    await repo.cleanup();
  }
}

async function captureClaude(outDir) {
  assertCommandExists("claude");
  const repo = await createFixtureRepo("claude");
  const runtimeHome = await createRuntimeHome("claude");
  const recorder = await startClaudeRecorder();
  try {
    const env = claudeCaptureEnv(recorder.url, runtimeHome.path);
    const args = [
      "--print",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--permission-mode",
      "bypassPermissions",
      codingPrompt(),
    ];
    const result = await runCommand("claude", args, {
      cwd: repo.path,
      env,
      timeoutMs: 45_000,
    });
    const capture = largestCapture(recorder.captures, "/v1/messages");
    if (!capture) {
      throw new Error(`Claude produced no /v1/messages request. stderr: ${result.stderr}`);
    }
    const payload = sanitizePayload(capture.body, [repo.path, runtimeHome.path]);
    const file = path.join(outDir, "claude-headless-coding-session.messages.json");
    await writePayload(file, payload);
    return fixtureResult("claude", file, payload, result, recorder.captures.length);
  } finally {
    await recorder.close();
    await runtimeHome.cleanup();
    await repo.cleanup();
  }
}

function assertCommandExists(command) {
  const pathParts = (process.env.PATH ?? "").split(path.delimiter);
  const suffixes = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathParts) {
    for (const suffix of suffixes) {
      if (existsSync(path.join(dir, `${command}${suffix}`))) {
        return;
      }
    }
  }
  throw new Error(`Required command not found on PATH: ${command}`);
}

async function createFixtureRepo(prefix) {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), `togetherlink-${prefix}-session-`));
  await mkdir(path.join(repoPath, "lib"), { recursive: true });
  await mkdir(path.join(repoPath, "test"), { recursive: true });
  await writeFile(
    path.join(repoPath, "package.json"),
    `${JSON.stringify({ type: "module", scripts: { test: "node test/stats.test.js" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "README.md"),
    [
      "# Session Fixture",
      "",
      "This tiny package exposes numeric helpers used by reports.",
      "The next change is to add a median helper and document its behavior.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "lib/stats.js"),
    [
      "export function sum(values) {",
      "  return values.reduce((total, value) => total + value, 0);",
      "}",
      "",
      "export function average(values) {",
      "  return values.length === 0 ? 0 : sum(values) / values.length;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(repoPath, "test/stats.test.js"),
    [
      'import { average, sum } from "../lib/stats.js";',
      "",
      "if (sum([2, 3, 5]) !== 10) throw new Error('sum failed');",
      "if (average([2, 4, 6]) !== 4) throw new Error('average failed');",
      "",
    ].join("\n"),
    "utf8",
  );
  return {
    path: repoPath,
    cleanup: () => rm(repoPath, { recursive: true, force: true }),
  };
}

async function createRuntimeHome(prefix) {
  const homePath = await mkdtemp(path.join(os.tmpdir(), `togetherlink-${prefix}-home-`));
  await mkdir(path.join(homePath, ".config"), { recursive: true });
  await mkdir(path.join(homePath, ".cache"), { recursive: true });
  await mkdir(path.join(homePath, ".local/share"), { recursive: true });
  return {
    path: homePath,
    cleanup: () => rm(homePath, { recursive: true, force: true }),
  };
}

function isolatedHomeEnv(homePath) {
  return {
    ...process.env,
    HOME: homePath,
    USERPROFILE: homePath,
    XDG_CONFIG_HOME: path.join(homePath, ".config"),
    XDG_CACHE_HOME: path.join(homePath, ".cache"),
    XDG_DATA_HOME: path.join(homePath, ".local/share"),
    CLAUDE_CONFIG_DIR: path.join(homePath, ".claude"),
  };
}

function codingPrompt() {
  return [
    "Inspect this repository like a coding agent preparing a small patch.",
    "Read README.md, lib/stats.js, and test/stats.test.js.",
    "Then summarize what change should be made next. Do not modify files.",
  ].join(" ");
}

async function startCodexRecorder() {
  const catalog = await loadCodexCatalog();
  const captures = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    if (req.method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method === "GET" && requestPath(req).startsWith("/v1/models")) {
      writeJson(res, 200, catalog);
      return;
    }
    if (req.method === "POST" && requestPath(req) === "/v1/responses") {
      const body = raw ? JSON.parse(raw) : {};
      captures.push({ path: requestPath(req), body });
      writeCodexResponse(res, body);
      return;
    }
    writeJson(res, 404, { error: `Unsupported recorder route ${req.method} ${req.url}` });
  });
  const url = await listen(server);
  return { url, captures, close: () => closeServer(server) };
}

async function startClaudeRecorder() {
  const captures = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    const path = requestPath(req);
    if (req.method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }
    if (req.method === "GET" && path.startsWith("/v1/models")) {
      writeJson(res, 200, {
        data: [
          {
            id: GLM_ANTHROPIC_ALIAS,
            type: "model",
            display_name: GLM_NAME,
            created_at: "2026-01-01T00:00:00Z",
            max_input_tokens: GLM_CONTEXT,
            max_tokens: GLM_OUTPUT,
          },
        ],
      });
      return;
    }
    if (req.method === "POST" && path === "/v1/messages/count_tokens") {
      captures.push({ path, body: raw ? JSON.parse(raw) : {} });
      writeJson(res, 200, { input_tokens: 128 });
      return;
    }
    if (req.method === "POST" && path === "/v1/messages") {
      const body = raw ? JSON.parse(raw) : {};
      captures.push({ path, body });
      writeClaudeResponse(res, body);
      return;
    }
    writeJson(res, 404, { error: `Unsupported recorder route ${req.method} ${req.url}` });
  });
  const url = await listen(server);
  return { url, captures, close: () => closeServer(server) };
}

async function loadCodexCatalog() {
  const distCatalogPath = path.join(REPO_ROOT, "packages/cli/dist/lib/codex/catalog.js");
  try {
    const module = await import(pathToFileURL(distCatalogPath).href);
    return JSON.parse(module.codexModelCatalogJson());
  } catch {
    return {
      models: [
        {
          slug: GLM_MODEL_ID,
          display_name: GLM_NAME,
          description: "Together AI model via togetherlink",
          default_reasoning_level: "medium",
          supported_reasoning_levels: [{ effort: "medium", description: "Default" }],
          shell_type: "shell_command",
          visibility: "list",
          supported_in_api: true,
          priority: 0,
          model_messages: { instructions_template: "You are Codex.\n\n{{ personality }}" },
          supports_personality: true,
          supports_reasoning_summaries: true,
          default_reasoning_summary: "auto",
          apply_patch_tool_type: "freeform",
          web_search_tool_type: "text_and_image",
          truncation_policy: { mode: "tokens", limit: GLM_CONTEXT },
          supports_parallel_tool_calls: true,
          context_window: GLM_CONTEXT,
          max_context_window: GLM_CONTEXT,
          comp_hash: null,
          input_modalities: ["text"],
          supports_search_tool: false,
          use_responses_lite: false,
        },
      ],
    };
  }
}

function writeCodexResponse(res, body) {
  const text = "CAPTURE_OK";
  const responseId = "resp_capture";
  const itemId = "msg_capture";
  const model = body.model ?? GLM_MODEL_ID;
  const messageItem = {
    id: itemId,
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  };
  const response = {
    id: responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    model,
    output: [messageItem],
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };

  if (!body.stream) {
    writeJson(res, 200, response);
    return;
  }

  let sequenceNumber = 0;
  const event = (name, data) => {
    const payload =
      data && typeof data === "object" && !Array.isArray(data)
        ? { ...data, sequence_number: sequenceNumber }
        : data;
    sequenceNumber += 1;
    res.write(`event: ${name}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  event("response.created", {
    type: "response.created",
    response: { ...response, status: "in_progress", output: [] },
  });
  event("response.in_progress", {
    type: "response.in_progress",
    response: { ...response, status: "in_progress", output: [] },
  });
  event("response.output_item.added", {
    type: "response.output_item.added",
    output_index: 0,
    item: messageItem,
  });
  event("response.content_part.added", {
    type: "response.content_part.added",
    item_id: itemId,
    output_index: 0,
    content_index: 0,
    part: { type: "output_text", text: "", annotations: [] },
  });
  event("response.output_text.delta", {
    type: "response.output_text.delta",
    item_id: itemId,
    output_index: 0,
    content_index: 0,
    delta: text,
  });
  event("response.output_text.done", {
    type: "response.output_text.done",
    item_id: itemId,
    output_index: 0,
    content_index: 0,
    text,
  });
  event("response.content_part.done", {
    type: "response.content_part.done",
    item_id: itemId,
    output_index: 0,
    content_index: 0,
    part: { type: "output_text", text, annotations: [] },
  });
  event("response.output_item.done", {
    type: "response.output_item.done",
    output_index: 0,
    item: messageItem,
  });
  event("response.completed", { type: "response.completed", response });
  res.end();
}

function writeClaudeResponse(res, body) {
  const text = "CAPTURE_OK";
  const model = body.model ?? GLM_ANTHROPIC_ALIAS;
  if (!body.stream) {
    writeJson(res, 200, claudeMessage(model, text));
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  writeSse(res, "message_start", {
    type: "message_start",
    message: {
      id: "msg_capture",
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    },
  });
  writeSse(res, "content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });
  writeSse(res, "content_block_delta", {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  });
  writeSse(res, "content_block_stop", { type: "content_block_stop", index: 0 });
  writeSse(res, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: 1 },
  });
  writeSse(res, "message_stop", { type: "message_stop" });
  res.end();
}

function claudeMessage(model, text) {
  return {
    id: "msg_capture",
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function claudeCaptureEnv(url, homePath) {
  const env = {
    ...isolatedHomeEnv(homePath),
    ANTHROPIC_BASE_URL: url,
    ANTHROPIC_AUTH_TOKEN: "local-token",
    ANTHROPIC_MODEL: GLM_ANTHROPIC_ALIAS,
    ANTHROPIC_DEFAULT_OPUS_MODEL: GLM_ANTHROPIC_ALIAS,
    ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: GLM_NAME,
    ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION: "Local recorder for proxy benchmark capture",
    ANTHROPIC_DEFAULT_SONNET_MODEL: GLM_ANTHROPIC_ALIAS,
    ANTHROPIC_DEFAULT_SONNET_MODEL_NAME: GLM_NAME,
    ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION: "Local recorder for proxy benchmark capture",
    ANTHROPIC_DEFAULT_HAIKU_MODEL: GLM_ANTHROPIC_ALIAS,
    ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME: GLM_NAME,
    ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION: "Local recorder for proxy benchmark capture",
    ANTHROPIC_CUSTOM_MODEL_OPTION: GLM_ANTHROPIC_ALIAS,
    ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: GLM_NAME,
    ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: "Local recorder for proxy benchmark capture",
    ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES: GLM_ANTHROPIC_CAPABILITIES,
    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
    DISABLE_FEEDBACK_COMMAND: "1",
  };
  for (const key of ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]) {
    delete env[key];
  }
  return env;
}

async function runCommand(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
  }, options.timeoutMs);
  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  clearTimeout(timer);
  return { status, stdout, stderr };
}

function largestCapture(captures, pathName) {
  return captures
    .filter((capture) => capture.path === pathName)
    .map((capture) => ({
      ...capture,
      bytes: Buffer.byteLength(JSON.stringify(capture.body), "utf8"),
    }))
    .sort((a, b) => b.bytes - a.bytes)[0];
}

function sanitizePayload(value, privatePaths) {
  const replacements = privatePaths.flatMap((privatePath, index) => {
    const label = index === 0 ? "<fixture-repo>" : "<capture-home>";
    return [
      [`/private${privatePath}`, label],
      [privatePath, label],
    ];
  });
  replacements.push(
    [os.homedir(), "<home>"],
    [REPO_ROOT, "<repo-root>"],
    [`/private${os.tmpdir()}`, "<tmp>"],
    [os.tmpdir(), "<tmp>"],
  );
  replacements.sort((a, b) => b[0].length - a[0].length);
  const sanitize = (input) => {
    if (Array.isArray(input)) {
      return input.map(sanitize);
    }
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, sanitize(item)]));
    }
    if (typeof input === "string") {
      let output = input;
      for (const [from, to] of replacements) {
        output = output.split(from).join(to);
      }
      return output.replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        "<uuid>",
      );
    }
    return input;
  };
  return sanitize(value);
}

async function writePayload(file, payload) {
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function fixtureResult(agent, file, payload, result, capturedRequests) {
  return {
    agent,
    file: path.relative(REPO_ROOT, file),
    payloadBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
    capturedRequests,
    status: result.status,
    stdoutBytes: Buffer.byteLength(result.stdout, "utf8"),
    stderrBytes: Buffer.byteLength(result.stderr, "utf8"),
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function requestPath(req) {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

function writeJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("recorder server did not bind a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}
