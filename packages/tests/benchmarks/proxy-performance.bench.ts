import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import http, { type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";
import { Readable } from "node:stream";
import { afterEach, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { CostTracker } from "../../cli/src/lib/claude/cost.js";
import { handleProxyRequest, type ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";

const realFetch = globalThis.fetch.bind(globalThis);
const CODEX_CAPTURED_FIXTURE = new URL(
  "../fixtures/proxy/codex-headless-coding-session.responses.json",
  import.meta.url,
);
const CLAUDE_CAPTURED_FIXTURE = new URL(
  "../fixtures/proxy/claude-headless-coding-session.messages.json",
  import.meta.url,
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("local proxy translation overhead", async () => {
  let upstreamRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
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
    }),
  );

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
    const codexLargePayload = codexLargeBenchmarkPayload();
    const claudePayload = claudeBenchmarkPayload();
    const claudeLargePayload = claudeLargeBenchmarkPayload();
    const controlResult = await benchmark("control-http-json", 300, 50, async () => {
      const response = await realFetch(control.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(codexPayload),
      });
      await response.json();
    });
    const controlLargeResult = await benchmark("control-large-http-json", 80, 10, async () => {
      const response = await realFetch(control.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(codexLargePayload),
      });
      await response.json();
    });
    const codexBuffered = await benchmark("codex-buffered", 300, 50, async () => {
      const response = await realFetch(`${codex.url}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(codexPayload),
      });
      const json = (await response.json()) as { output?: unknown };
      if (!json.output) {
        throw new Error("missing Codex output");
      }
    });
    codexBuffered.baselineSize = "medium";
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
    codexStreamed.baselineSize = "medium";
    const codexLargeBuffered = await benchmark("codex-large-buffered", 50, 8, async () => {
      const response = await realFetch(`${codex.url}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(codexLargePayload),
      });
      const json = (await response.json()) as { output?: unknown };
      if (!json.output) {
        throw new Error("missing large Codex output");
      }
    });
    codexLargeBuffered.baselineSize = "large";
    const codexLargeStreamed = await benchmark("codex-large-streamed", 40, 8, async () => {
      const response = await realFetch(`${codex.url}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify({ ...codexLargePayload, stream: true }),
      });
      const text = await response.text();
      if (!text.includes("response.completed")) {
        throw new Error("missing large Codex stream completion");
      }
    });
    codexLargeStreamed.baselineSize = "large";
    const claudeBuffered = await benchmark("claude-buffered", 300, 50, async () => {
      const response = await realFetch(`${claude.url}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(claudePayload),
      });
      const json = (await response.json()) as { content?: unknown };
      if (!json.content) {
        throw new Error("missing Claude output");
      }
    });
    claudeBuffered.baselineSize = "medium";
    const claudeLargeBuffered = await benchmark("claude-large-buffered", 50, 8, async () => {
      const response = await realFetch(`${claude.url}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer local-token" },
        body: JSON.stringify(claudeLargePayload),
      });
      const json = (await response.json()) as { content?: unknown };
      if (!json.content) {
        throw new Error("missing large Claude output");
      }
    });
    claudeLargeBuffered.baselineSize = "large";

    const rows = [
      controlResult,
      controlLargeResult,
      codexBuffered,
      codexStreamed,
      codexLargeBuffered,
      codexLargeStreamed,
      claudeBuffered,
      claudeLargeBuffered,
    ];
    const controlBySize = new Map<string, BenchmarkRow>([
      ["medium", controlResult],
      ["large", controlLargeResult],
    ]);
    const approximateProxyOverhead = rows
      .filter((row) => row.baselineSize)
      .map((row) => {
        const baseline = controlBySize.get(row.baselineSize);
        if (!baseline) {
          throw new Error(`missing baseline for ${row.baselineSize}`);
        }
        return {
          name: row.name,
          baseline: baseline.name,
          p50MinusControlMs: round(row.p50Ms - baseline.p50Ms),
          p95MinusControlMs: round(row.p95Ms - baseline.p95Ms),
          meanMinusControlMs: round(row.meanMs - baseline.meanMs),
        };
      });
    const result = {
      rows,
      approximateProxyOverhead,
      payloadBytes: {
        codexMedium: byteLength(codexPayload),
        codexLarge: byteLength(codexLargePayload),
        claudeMedium: byteLength(claudePayload),
        claudeLarge: byteLength(claudeLargePayload),
      },
      upstreamRequests,
      notes: [
        "Together upstream is mocked, so this measures local proxy translation and forwarding overhead.",
        "Subtracting matching control rows estimates overhead beyond local HTTP/fetch cost.",
      ],
    };

    console.log(JSON.stringify(result, null, 2));
    expect(upstreamRequests).toBeGreaterThan(0);
    expect(rows.every((row) => row.p95Ms < sanityP95CeilingMs())).toBe(true);

    const overheadCeiling = optionalOverheadCeilingMs();
    if (overheadCeiling !== undefined) {
      expect(
        approximateProxyOverhead.every((row) => row.p95MinusControlMs <= overheadCeiling),
      ).toBe(true);
    }
  } finally {
    await Promise.all([control.close(), codex.close(), claude.close()]);
  }
}, 30_000);

test("large proxy in-process translation breakdown", async () => {
  const codexLargePayload = codexLargeBenchmarkPayload();
  const codexLargeBody = JSON.stringify(codexLargePayload);
  const codexLargeStreamBody = JSON.stringify({ ...codexLargePayload, stream: true });
  const claudeLargePayload = claudeLargeBenchmarkPayload();
  const claudeLargeBody = JSON.stringify(claudeLargePayload);
  let upstreamRequests = 0;
  let upstreamStream = false;
  const upstreamJsonBody = JSON.stringify({
    id: "chatcmpl_bench",
    choices: [{ message: { reasoning: "ok", content: "hello" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 },
  });
  const upstreamSseBody = `${[
    { choices: [{ delta: { reasoning_content: "ok " } }] },
    { choices: [{ delta: { content: "hello" }, finish_reason: "stop" }] },
    { usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 } },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("")}data: [DONE]\n\n`;

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      upstreamRequests += 1;
      if (upstreamStream) {
        return new Response(upstreamSseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(upstreamJsonBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  const codexProxyOptions = codexOptions();
  const claudeProxyOptions = claudeOptions();
  const callCodexDirect = async (body: string, stream: boolean): Promise<void> => {
    upstreamStream = stream;
    const response = await invokeProxyHandler(body, "/v1/responses", (req, res) =>
      handleCodexProxyRequest(req, res, codexProxyOptions),
    );
    if (response.statusCode !== 200) {
      throw new Error(`Codex direct call failed: ${response.statusCode} ${response.body}`);
    }
    const expected = stream ? "response.completed" : '"output"';
    if (!response.body.includes(expected)) {
      throw new Error(`missing Codex direct output marker ${expected}`);
    }
  };
  const callClaudeDirect = async (body: string): Promise<void> => {
    upstreamStream = false;
    const response = await invokeProxyHandler(body, "/v1/messages", (req, res) =>
      handleProxyRequest(req, res, claudeProxyOptions),
    );
    if (response.statusCode !== 200) {
      throw new Error(`Claude direct call failed: ${response.statusCode} ${response.body}`);
    }
    if (!response.body.includes('"content"')) {
      throw new Error("missing Claude direct output");
    }
  };

  const rows = [
    await benchmarkWithJsonInstrumentation("codex-large-direct-buffered", 40, 8, () =>
      callCodexDirect(codexLargeBody, false),
    ),
    await benchmarkWithJsonInstrumentation("codex-large-direct-streamed", 40, 8, () =>
      callCodexDirect(codexLargeStreamBody, true),
    ),
    await benchmarkWithJsonInstrumentation("claude-large-direct-buffered", 40, 8, () =>
      callClaudeDirect(claudeLargeBody),
    ),
  ];
  const result = {
    rows,
    payloadBytes: {
      codexLarge: Buffer.byteLength(codexLargeBody, "utf8"),
      codexLargeStream: Buffer.byteLength(codexLargeStreamBody, "utf8"),
      claudeLarge: Buffer.byteLength(claudeLargeBody, "utf8"),
    },
    upstreamRequests,
    notes: [
      "This bypasses local TCP/fetch client cost and calls the real proxy handlers in-process.",
      "Request bodies are stringified before timing starts; JSON stats are only from proxy handler execution.",
      "JSON time includes inbound request parse, upstream Together request serialization, upstream response parse, and outbound client response serialization.",
    ],
  };

  console.log(JSON.stringify(result, null, 2));
  expect(upstreamRequests).toBeGreaterThan(0);
  expect(rows.every((row) => row.p95Ms < sanityP95CeilingMs())).toBe(true);
}, 30_000);

test("captured headless proxy payload breakdown", async () => {
  const codexCaptured = loadCapturedPayload(CODEX_CAPTURED_FIXTURE);
  const claudeCaptured = loadCapturedPayload(CLAUDE_CAPTURED_FIXTURE);
  const rows: InstrumentedBenchmarkRow[] = [];
  let upstreamRequests = 0;
  let upstreamStream = false;
  const upstreamJsonBody = JSON.stringify({
    id: "chatcmpl_bench",
    choices: [{ message: { reasoning: "ok", content: "hello" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 },
  });
  const upstreamSseBody = `${[
    { choices: [{ delta: { reasoning_content: "ok " } }] },
    { choices: [{ delta: { content: "hello" }, finish_reason: "stop" }] },
    { usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 } },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("")}data: [DONE]\n\n`;

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      upstreamRequests += 1;
      if (upstreamStream) {
        return new Response(upstreamSseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(upstreamJsonBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  const codexProxyOptions = codexOptions();
  const claudeProxyOptions = claudeOptions();
  if (codexCaptured) {
    const body = JSON.stringify(codexCaptured);
    const stream = Boolean(codexCaptured.stream);
    rows.push(
      await benchmarkWithJsonInstrumentation("codex-captured-headless", 80, 10, async () => {
        upstreamStream = stream;
        const response = await invokeProxyHandler(body, "/v1/responses", (req, res) =>
          handleCodexProxyRequest(req, res, codexProxyOptions),
        );
        if (response.statusCode !== 200) {
          throw new Error(`captured Codex call failed: ${response.statusCode} ${response.body}`);
        }
        const expected = stream ? "response.completed" : '"output"';
        if (!response.body.includes(expected)) {
          throw new Error(`missing captured Codex output marker ${expected}`);
        }
      }),
    );
  }
  if (claudeCaptured) {
    const body = JSON.stringify(claudeCaptured);
    const stream = Boolean(claudeCaptured.stream);
    rows.push(
      await benchmarkWithJsonInstrumentation("claude-captured-headless", 80, 10, async () => {
        upstreamStream = stream;
        const response = await invokeProxyHandler(body, "/v1/messages", (req, res) =>
          handleProxyRequest(req, res, claudeProxyOptions),
        );
        if (response.statusCode !== 200) {
          throw new Error(`captured Claude call failed: ${response.statusCode} ${response.body}`);
        }
        const expected = stream ? "message_stop" : '"content"';
        if (!response.body.includes(expected)) {
          throw new Error(`missing captured Claude output marker ${expected}`);
        }
      }),
    );
  }

  const result = {
    rows,
    payloadBytes: {
      ...(codexCaptured ? { codexCaptured: byteLength(codexCaptured) } : {}),
      ...(claudeCaptured ? { claudeCaptured: byteLength(claudeCaptured) } : {}),
    },
    upstreamRequests,
    fixtureFiles: {
      codex: existsSync(CODEX_CAPTURED_FIXTURE),
      claude: existsSync(CLAUDE_CAPTURED_FIXTURE),
    },
    notes: [
      "Fixtures are captured from installed headless Codex/Claude Code clients using packages/tests/scripts/capture-proxy-fixtures.mjs.",
      "The recorder saves the largest real inbound client payload and the benchmark replays it through the real togetherlink proxy handlers.",
    ],
  };

  console.log(JSON.stringify(result, null, 2));
  expect(rows.length).toBeGreaterThan(0);
  expect(upstreamRequests).toBeGreaterThan(0);
  expect(rows.every((row) => row.p95Ms < sanityP95CeilingMs())).toBe(true);
}, 30_000);

test("streaming TTFT and concurrent captured proxy load", async () => {
  const codexCaptured = loadCapturedPayload(CODEX_CAPTURED_FIXTURE);
  const claudeCaptured = loadCapturedPayload(CLAUDE_CAPTURED_FIXTURE);
  if (!codexCaptured || !claudeCaptured) {
    throw new Error("captured fixtures are required for TTFT and concurrent proxy load benchmark");
  }

  let upstreamRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (href.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }

      upstreamRequests += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { stream?: boolean };
      if (body.stream) {
        return delayedSseResponse([
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
    }),
  );

  const codexProxyOptions = codexOptions();
  const claudeProxyOptions = claudeOptions();
  const proxy = await createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const handler =
      path === "/v1/responses"
        ? handleCodexProxyRequest(req, res, codexProxyOptions)
        : handleProxyRequest(req, res, claudeProxyOptions);
    handler.catch((err) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });

  try {
    const codexBody = JSON.stringify({ ...codexCaptured, stream: true });
    const claudeBody = JSON.stringify({ ...claudeCaptured, stream: true });
    const codexTtft = await benchmarkStreamingTtft("codex-captured-stream-ttft", 40, 8, async () =>
      fetchTextWithTtft(`${proxy.url}/v1/responses`, codexBody, {
        firstMarker: "response.reasoning_text.delta",
        completionMarker: "response.completed",
      }),
    );
    const claudeTtft = await benchmarkStreamingTtft(
      "claude-captured-stream-ttft",
      40,
      8,
      async () =>
        fetchTextWithTtft(`${proxy.url}/v1/messages`, claudeBody, {
          firstMarker: "content_block_delta",
          completionMarker: "message_stop",
        }),
    );
    const concurrentCaptured = await benchmark(
      "concurrent-captured-proxy-load",
      30,
      5,
      async () => {
        await Promise.all([
          fetchTextWithTtft(`${proxy.url}/v1/responses`, codexBody, {
            firstMarker: "response.reasoning_text.delta",
            completionMarker: "response.completed",
          }),
          fetchTextWithTtft(`${proxy.url}/v1/responses`, codexBody, {
            firstMarker: "response.reasoning_text.delta",
            completionMarker: "response.completed",
          }),
          fetchTextWithTtft(`${proxy.url}/v1/messages`, claudeBody, {
            firstMarker: "content_block_delta",
            completionMarker: "message_stop",
          }),
          fetchTextWithTtft(`${proxy.url}/v1/messages`, claudeBody, {
            firstMarker: "content_block_delta",
            completionMarker: "message_stop",
          }),
        ]);
      },
    );

    const result = {
      ttftRows: [codexTtft, claudeTtft],
      concurrentRows: [concurrentCaptured],
      concurrentRequestsPerIteration: 4,
      payloadBytes: {
        codexCaptured: byteLength(codexCaptured),
        claudeCaptured: byteLength(claudeCaptured),
      },
      upstreamRequests,
      notes: [
        "TTFT is measured from local client request start to the first visible streamed delta marker.",
        "The concurrent row runs two Codex and two Claude captured stream requests against one local proxy server per iteration.",
      ],
    };

    console.log(JSON.stringify(result, null, 2));
    expect(upstreamRequests).toBeGreaterThan(0);
    expect([codexTtft, claudeTtft, concurrentCaptured].every((row) => row.p95Ms < 250)).toBe(true);
    expect([codexTtft, claudeTtft].every((row) => row.ttft.p95Ms < 250)).toBe(true);
  } finally {
    await proxy.close();
  }
}, 30_000);

async function benchmark(
  name: string,
  iterations: number,
  warmup: number,
  fn: () => Promise<void>,
): Promise<BenchmarkRow> {
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

function summarizeDurations(name: string, iterations: number, durations: number[]): BenchmarkRow {
  durations.sort((a, b) => a - b);
  const summary = summarizeDurationSet(durations);
  return {
    name,
    iterations,
    ...summary,
  };
}

async function benchmarkStreamingTtft(
  name: string,
  iterations: number,
  warmup: number,
  fn: () => Promise<StreamingTtftResult>,
): Promise<StreamingTtftBenchmarkRow> {
  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const durations: number[] = [];
  const ttfts: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    const { ttftMs } = await fn();
    durations.push(performance.now() - started);
    ttfts.push(ttftMs);
  }

  return {
    ...summarizeDurations(name, iterations, durations),
    ttft: summarizeDurationSet(ttfts),
  };
}

async function benchmarkWithJsonInstrumentation(
  name: string,
  iterations: number,
  warmup: number,
  fn: () => Promise<void>,
): Promise<InstrumentedBenchmarkRow> {
  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const durations: number[] = [];
  const jsonStats = emptyJsonStats();
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    const { stats } = await withJsonInstrumentation(fn);
    durations.push(performance.now() - started);
    addJsonStats(jsonStats, stats);
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((total, value) => total + value, 0);
  const meanMs = sum / durations.length;
  return {
    name,
    iterations,
    minMs: round(durations[0] ?? 0),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    p99Ms: round(percentile(durations, 99)),
    meanMs: round(meanMs),
    maxMs: round(durations[durations.length - 1] ?? 0),
    json: summarizeJsonStats(jsonStats, iterations, meanMs),
  };
}

type BenchmarkRow = {
  name: string;
  iterations: number;
  baselineSize?: "medium" | "large";
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  maxMs: number;
};

type StreamingTtftResult = {
  ttftMs: number;
};

type StreamingTtftBenchmarkRow = BenchmarkRow & {
  ttft: DurationSummary;
};

type DurationSummary = {
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  maxMs: number;
};

type InstrumentedBenchmarkRow = BenchmarkRow & {
  json: {
    parseCallsPerRun: number;
    parseMeanMs: number;
    parseMaxMs: number;
    parseBytesPerRun: number;
    stringifyCallsPerRun: number;
    stringifyMeanMs: number;
    stringifyMaxMs: number;
    stringifyBytesPerRun: number;
    jsonMeanMs: number;
    nonJsonMeanMs: number;
  };
};

type JsonStats = {
  parse: JsonMetric;
  stringify: JsonMetric;
};

type JsonMetric = {
  calls: number;
  totalMs: number;
  maxMs: number;
  bytes: number;
};

async function withJsonInstrumentation<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stats: JsonStats }> {
  const originalParse = JSON.parse;
  const originalStringify = JSON.stringify;
  const stats = emptyJsonStats();

  JSON.parse = ((text: string, reviver?: Parameters<typeof JSON.parse>[1]) => {
    const started = performance.now();
    try {
      return Reflect.apply(originalParse, JSON, [text, reviver]) as unknown;
    } finally {
      recordJsonMetric(stats.parse, started, Buffer.byteLength(text, "utf8"));
    }
  }) as typeof JSON.parse;

  JSON.stringify = ((
    value: unknown,
    replacer?: Parameters<typeof JSON.stringify>[1],
    space?: Parameters<typeof JSON.stringify>[2],
  ) => {
    const started = performance.now();
    let output: string | undefined;
    try {
      output = Reflect.apply(originalStringify, JSON, [value, replacer, space]) as
        | string
        | undefined;
      return output;
    } finally {
      recordJsonMetric(
        stats.stringify,
        started,
        output === undefined ? 0 : Buffer.byteLength(output, "utf8"),
      );
    }
  }) as typeof JSON.stringify;

  try {
    return { result: await fn(), stats };
  } finally {
    JSON.parse = originalParse;
    JSON.stringify = originalStringify;
  }
}

function emptyJsonStats(): JsonStats {
  return {
    parse: { calls: 0, totalMs: 0, maxMs: 0, bytes: 0 },
    stringify: { calls: 0, totalMs: 0, maxMs: 0, bytes: 0 },
  };
}

function recordJsonMetric(metric: JsonMetric, started: number, bytes: number): void {
  const elapsed = performance.now() - started;
  metric.calls += 1;
  metric.totalMs += elapsed;
  metric.maxMs = Math.max(metric.maxMs, elapsed);
  metric.bytes += bytes;
}

function addJsonStats(target: JsonStats, source: JsonStats): void {
  addJsonMetric(target.parse, source.parse);
  addJsonMetric(target.stringify, source.stringify);
}

function addJsonMetric(target: JsonMetric, source: JsonMetric): void {
  target.calls += source.calls;
  target.totalMs += source.totalMs;
  target.maxMs = Math.max(target.maxMs, source.maxMs);
  target.bytes += source.bytes;
}

function summarizeJsonStats(
  stats: JsonStats,
  iterations: number,
  totalMeanMs: number,
): InstrumentedBenchmarkRow["json"] {
  const jsonMeanMs = (stats.parse.totalMs + stats.stringify.totalMs) / iterations;
  return {
    parseCallsPerRun: round(stats.parse.calls / iterations),
    parseMeanMs: round(stats.parse.totalMs / iterations),
    parseMaxMs: round(stats.parse.maxMs),
    parseBytesPerRun: Math.round(stats.parse.bytes / iterations),
    stringifyCallsPerRun: round(stats.stringify.calls / iterations),
    stringifyMeanMs: round(stats.stringify.totalMs / iterations),
    stringifyMaxMs: round(stats.stringify.maxMs),
    stringifyBytesPerRun: Math.round(stats.stringify.bytes / iterations),
    jsonMeanMs: round(jsonMeanMs),
    nonJsonMeanMs: round(Math.max(0, totalMeanMs - jsonMeanMs)),
  };
}

function summarizeDurationSet(values: number[]): DurationSummary {
  values.sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    minMs: round(values[0] ?? 0),
    p50Ms: round(percentile(values, 50)),
    p95Ms: round(percentile(values, 95)),
    p99Ms: round(percentile(values, 99)),
    meanMs: round(values.length === 0 ? 0 : sum / values.length),
    maxMs: round(values[values.length - 1] ?? 0),
  };
}

function percentile(sorted: number[], rank: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function loadCapturedPayload(file: URL): Record<string, unknown> | undefined {
  if (!existsSync(file)) {
    return undefined;
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Captured fixture must be a JSON object: ${file.pathname}`);
  }
  return parsed as Record<string, unknown>;
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
          {
            type: "function",
            name: "spawn_agent",
            parameters: { type: "object", properties: { task: { type: "string" } } },
          },
          {
            type: "function",
            name: "read_result",
            parameters: { type: "object", properties: { id: { type: "string" } } },
          },
        ],
      },
      {
        type: "custom",
        name: "apply_patch",
        format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
      },
    ],
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Summarize the local proxy path." }],
      },
      ...Array.from({ length: 12 }, (_, index) => ({
        type: "message",
        role: index % 2 === 0 ? "assistant" : "user",
        content: [{ type: "input_text", text: `context item ${index} ${"payload ".repeat(80)}` }],
      })),
    ],
  };
}

function codexLargeBenchmarkPayload(): Record<string, unknown> {
  return {
    ...codexBenchmarkPayload(),
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Summarize this long session." }],
      },
      ...Array.from({ length: 80 }, (_, index) => ({
        type: "message",
        role: index % 2 === 0 ? "assistant" : "user",
        content: [
          {
            type: "input_text",
            text: `long session item ${index}\n${largeText(index)}`,
          },
        ],
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

function claudeLargeBenchmarkPayload(): Record<string, unknown> {
  return {
    ...claudeBenchmarkPayload(),
    messages: Array.from({ length: 80 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `${index % 2 === 0 ? "Question" : "Answer"} ${index}:\n${largeText(index)}`,
    })),
  };
}

function largeText(seed: number): string {
  return `chunk-${seed} ${"long-session-payload ".repeat(720)}`;
}

async function invokeProxyHandler(
  body: string,
  path: string,
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): Promise<MemoryResponse> {
  const req = Readable.from([body]) as Readable & Partial<IncomingMessage>;
  req.method = "POST";
  req.url = path;
  req.headers = {
    authorization: "Bearer local-token",
    "content-type": "application/json",
  };
  const res = new MemoryResponse();
  await handler(req as IncomingMessage, res as unknown as ServerResponse);
  return res;
}

class MemoryResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  body = "";
  private readonly headers = new Map<string, unknown>();

  writeHead(
    statusCode: number,
    statusMessageOrHeaders?: string | Record<string, unknown>,
    headers?: Record<string, unknown>,
  ): this {
    this.statusCode = statusCode;
    const headerBag = typeof statusMessageOrHeaders === "object" ? statusMessageOrHeaders : headers;
    if (headerBag) {
      for (const [name, value] of Object.entries(headerBag)) {
        this.setHeader(name, value);
      }
    }
    return this;
  }

  setHeader(name: string, value: unknown): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string): unknown {
    return this.headers.get(name.toLowerCase());
  }

  flushHeaders(): void {}

  write(chunk?: unknown): boolean {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    return true;
  }

  end(chunk?: unknown): this {
    this.write(chunk);
    this.writableEnded = true;
    this.emit("finish");
    this.emit("close");
    return this;
  }
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
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
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

function delayedSseResponse(chunks: unknown[], delayMs = 1): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of chunks) {
          await sleep(delayMs);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        await sleep(delayMs);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

async function fetchTextWithTtft(
  url: string,
  body: string,
  markers: { firstMarker: string; completionMarker: string },
): Promise<StreamingTtftResult> {
  const started = performance.now();
  const response = await realFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer local-token" },
    body,
  });
  if (!response.body) {
    throw new Error("missing streaming response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let ttftMs: number | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    text += decoder.decode(value, { stream: true });
    if (ttftMs === undefined && text.includes(markers.firstMarker)) {
      ttftMs = performance.now() - started;
    }
  }
  text += decoder.decode();

  if (response.status !== 200) {
    throw new Error(`stream request failed: ${response.status} ${text}`);
  }
  if (!text.includes(markers.completionMarker)) {
    throw new Error(`missing stream completion marker ${markers.completionMarker}`);
  }
  if (ttftMs === undefined) {
    throw new Error(`missing first stream marker ${markers.firstMarker}`);
  }
  return { ttftMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
