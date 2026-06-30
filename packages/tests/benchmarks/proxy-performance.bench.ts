import http, { type Server } from "node:http";
import { performance } from "node:perf_hooks";
import { afterEach, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { CostTracker } from "../../cli/src/lib/claude/cost.js";
import { handleProxyRequest, type ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";

const realFetch = globalThis.fetch.bind(globalThis);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("local proxy translation overhead", async () => {
  let upstreamRequests = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (href.startsWith("http://127.0.0.1:")) {
      return realFetch(url, init);
    }

    upstreamRequests += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as { stream?: boolean };
    if (body.stream) {
      return sseResponse([
        { choices: [{ delta: { reasoning_content: "ok " } }] },
        { choices: [{ delta: { content: "hello" }, finish_reason: "stop" }] },
        { usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 } },
      ]);
    }

    return jsonResponse({
      id: "chatcmpl_bench",
      choices: [{ message: { reasoning: "ok", content: "hello" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 },
    });
  }));

  const codexProxyOptions = codexOptions();
  const claudeProxyOptions = claudeOptions();
  const control = await createServer((req, res) => {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  const codex = await createServer((req, res) => {
    handleCodexProxyRequest(req, res, codexProxyOptions).catch((err) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });
  const claude = await createServer((req, res) => {
    handleProxyRequest(req, res, claudeProxyOptions).catch((err) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });

  try {
    const codexPayload = codexBenchmarkPayload();
    const claudePayload = claudeBenchmarkPayload();
    const controlResult = await benchmark("control-http-json", 300, 50, async () => {
      const response = await realFetch(control.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(codexPayload),
      });
      await response.json();
    });
    const codexBuffered = await benchmark("codex-buffered", 300, 50, async () => {
      const response = await realFetch(`${codex.url}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(codexPayload),
      });
      const json = await response.json() as { output?: unknown };
      if (!json.output) {
        throw new Error("missing Codex output");
      }
    });
    const codexStreamed = await benchmark("codex-streamed", 200, 30, async () => {
      const response = await realFetch(`${codex.url}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify({ ...codexPayload, stream: true }),
      });
      const text = await response.text();
      if (!text.includes("response.completed")) {
        throw new Error("missing Codex stream completion");
      }
    });
    const claudeBuffered = await benchmark("claude-buffered", 300, 50, async () => {
      const response = await realFetch(`${claude.url}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(claudePayload),
      });
      const json = await response.json() as { content?: unknown };
      if (!json.content) {
        throw new Error("missing Claude output");
      }
    });

    const rows = [controlResult, codexBuffered, codexStreamed, claudeBuffered];
    const approximateProxyOverhead = rows.slice(1).map((row) => ({
      name: row.name,
      p50MinusControlMs: round(row.p50Ms - controlResult.p50Ms),
      p95MinusControlMs: round(row.p95Ms - controlResult.p95Ms),
      meanMinusControlMs: round(row.meanMs - controlResult.meanMs),
    }));
    const result = {
      rows,
      approximateProxyOverhead,
      upstreamRequests,
      notes: [
        "Together upstream is mocked, so this measures local proxy translation and forwarding overhead.",
        "Subtracting control-http-json estimates overhead beyond local HTTP/fetch cost.",
      ],
    };

    console.log(JSON.stringify(result, null, 2));
    expect(upstreamRequests).toBe(930);
    expect(rows.every((row) => row.p95Ms < sanityP95CeilingMs())).toBe(true);

    const overheadCeiling = optionalOverheadCeilingMs();
    if (overheadCeiling !== undefined) {
      expect(approximateProxyOverhead.every((row) => row.p95MinusControlMs <= overheadCeiling)).toBe(true);
    }
  } finally {
    await Promise.all([control.close(), codex.close(), claude.close()]);
  }
}, 30_000);

async function benchmark(name: string, iterations: number, warmup: number, fn: () => Promise<void>): Promise<BenchmarkRow> {
  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    await fn();
    durations.push(performance.now() - started);
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((total, value) => total + value, 0);
  return {
    name,
    iterations,
    minMs: round(durations[0] ?? 0),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    p99Ms: round(percentile(durations, 99)),
    meanMs: round(sum / durations.length),
    maxMs: round(durations[durations.length - 1] ?? 0),
  };
}

type BenchmarkRow = {
  name: string;
  iterations: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  maxMs: number;
};

function percentile(sorted: number[], rank: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sanityP95CeilingMs(): number {
  const raw = process.env.TOGETHERLINK_PROXY_BENCH_MAX_RAW_P95_MS;
  return raw ? Number.parseFloat(raw) : 100;
}

function optionalOverheadCeilingMs(): number | undefined {
  const raw = process.env.TOGETHERLINK_PROXY_BENCH_MAX_P95_OVERHEAD_MS;
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function codexOptions(): CodexProxyOptions {
  return {
    apiKey: "test-together-key",
    modelId: GLM_5_2.id,
    targetModelId: GLM_5_2.id,
    modelName: GLM_5_2.name,
    modelDefinition: GLM_5_2,
    authToken: "local-token",
    costTracker: new CostTracker(GLM_5_2),
  };
}

function claudeOptions(): ClaudeProxyOptions {
  return {
    apiKey: "test-together-key",
    modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
    targetModelId: GLM_5_2.id,
    modelName: GLM_5_2.name,
    modelDefinition: GLM_5_2,
    authToken: "local-token",
    costTracker: new CostTracker(GLM_5_2),
  };
}

function codexBenchmarkPayload(): Record<string, unknown> {
  const tools = Array.from({ length: 18 }, (_, index) => ({
    type: "function",
    name: `tool_${index}`,
    description: `Tool ${index}`,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  }));

  return {
    model: GLM_5_2.id,
    instructions: "You are benchmarking local translation overhead.",
    max_output_tokens: 512,
    tools: [
      ...tools,
      {
        type: "namespace",
        name: "multi_agent_v1",
        tools: [
          { type: "function", name: "spawn_agent", parameters: { type: "object", properties: { task: { type: "string" } } } },
          { type: "function", name: "read_result", parameters: { type: "object", properties: { id: { type: "string" } } } },
        ],
      },
      { type: "custom", name: "apply_patch", format: { type: "grammar", syntax: "lark", definition: "start: /.+/" } },
    ],
    input: [
      { type: "message", role: "user", content: [{ type: "input_text", text: "Summarize the local proxy path." }] },
      ...Array.from({ length: 12 }, (_, index) => ({
        type: "message",
        role: index % 2 === 0 ? "assistant" : "user",
        content: [{ type: "input_text", text: `context item ${index} ${"payload ".repeat(80)}` }],
      })),
    ],
  };
}

function claudeBenchmarkPayload(): Record<string, unknown> {
  return {
    model: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
    max_tokens: 512,
    system: "You are benchmarking local translation overhead.",
    tools: Array.from({ length: 12 }, (_, index) => ({
      name: `tool_${index}`,
      description: `Tool ${index}`,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          query: { type: "string" },
        },
      },
    })),
    messages: Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `${index % 2 === 0 ? "Question" : "Answer"} ${index}: ${"payload ".repeat(80)}`,
    })),
  };
}

async function createServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server did not bind a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(chunks: unknown[]): Response {
  return new Response(
    `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}
