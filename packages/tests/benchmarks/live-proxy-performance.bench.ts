import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, expect, test } from "vitest";
import { GLM_5_2, TOGETHER_BASE_URL } from "@togetherlink/models";
import { CostTracker } from "../../cli/src/lib/claude/cost.js";
import { handleProxyRequest, type ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import type { ProxyPerfPayload } from "../../cli/src/lib/proxy-perf.js";

const maybeTest = process.env.TOGETHERLINK_LIVE_PROXY_BENCH === "1" ? test : test.skip;
const maybeConnectionTest =
  process.env.TOGETHERLINK_LIVE_CONNECTION_BENCH === "1" ? test : test.skip;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const iterations = positiveInt(process.env.TOGETHERLINK_LIVE_PROXY_BENCH_ITERATIONS) ?? 5;
const warmup = positiveInt(process.env.TOGETHERLINK_LIVE_PROXY_BENCH_WARMUP) ?? 1;

afterEach(() => {
  delete process.env.TOGETHERLINK_PERF;
});

maybeTest(
  "live Together direct vs Claude proxy latency",
  async () => {
    const apiKey = await resolveTogetherApiKey();
    const authToken = `live-proxy-bench-${Date.now()}`;
    const costTracker = new CostTracker(GLM_5_2);
    const perfPayloads: ProxyPerfPayload[] = [];
    const options: ClaudeProxyOptions = {
      apiKey,
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      authToken,
      debug: false,
      costTracker,
      perfSink: (payload) => perfPayloads.push(payload),
    };
    process.env.TOGETHERLINK_PERF = "1";
    const server = createServer((req, res) => {
      handleProxyRequest(req, res, options).catch((err) => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("live proxy benchmark server did not bind");
    }
    const proxyUrl = `http://127.0.0.1:${address.port}`;

    try {
      const buffered = [
        await runSeries("direct-together-buffered-live", () => directBuffered(apiKey)),
        await runSeries("claude-proxy-buffered-live", () => proxyBuffered(proxyUrl, authToken)),
      ];
      const streamed = [
        await runStreamSeries("direct-together-stream-live", () => directStream(apiKey)),
        await runStreamSeries("claude-proxy-stream-live", () => proxyStream(proxyUrl, authToken)),
      ];
      const result = {
        model: GLM_5_2.id,
        prompt: "Reply with exactly: pong",
        maxTokens: 12,
        iterations,
        warmup,
        buffered,
        streamed,
        proxyPerf: summarizeProxyPerf(perfPayloads),
        proxyCost: costTracker.totals,
        notes: [
          "Hits the real Together chat/completions API; this consumes API credits.",
          "Direct rows call Together directly. Proxy rows call the real Claude proxy handler in-process, which then calls Together.",
        ],
      };

      console.log(JSON.stringify(result, null, 2));
      expect(buffered).toHaveLength(2);
      expect(streamed).toHaveLength(2);
      expect(perfPayloads.length).toBeGreaterThanOrEqual(iterations * 2);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  },
  120_000,
);

maybeConnectionTest(
  "live Together connection reuse diagnostic",
  async () => {
    const apiKey = await resolveTogetherApiKey();
    const result = {
      endpoint: `${TOGETHER_BASE_URL}/models`,
      iterations,
      warmup,
      rows: [
        await runSeries("together-models-default-fetch", () => fetchModels(apiKey, {})),
        await runSeries("together-models-connection-close", () =>
          fetchModels(apiKey, { connection: "close" }),
        ),
      ],
      notes: [
        "Hits Together /models, not model generation, so it should not consume generation credits.",
        "Default Node fetch should reuse pooled connections. The connection-close row forces a fresh close after each response.",
        "Live network variance is high; use this as a sanity check before attempting keep-alive code changes.",
      ],
    };

    console.log(JSON.stringify(result, null, 2));
    expect(result.rows).toHaveLength(2);
  },
  60_000,
);

async function runSeries(name: string, fn: () => Promise<number>): Promise<BenchmarkRow> {
  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const values: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    values.push(await fn());
  }
  return summarize(name, values);
}

async function fetchModels(apiKey: string, extraHeaders: Record<string, string>): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${TOGETHER_BASE_URL}/models`, {
    headers: { authorization: `Bearer ${apiKey}`, ...extraHeaders },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`models fetch failed: ${response.status} ${text.slice(0, 500)}`);
  }
  return performance.now() - started;
}

async function runStreamSeries(
  name: string,
  fn: () => Promise<StreamTiming>,
): Promise<{ total: BenchmarkRow; ttft: BenchmarkRow }> {
  for (let i = 0; i < warmup; i += 1) {
    await fn();
  }

  const totals: number[] = [];
  const ttfts: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const result = await fn();
    totals.push(result.totalMs);
    ttfts.push(result.ttftMs);
  }
  return {
    total: summarize(`${name}-total`, totals),
    ttft: summarize(`${name}-ttft`, ttfts),
  };
}

async function directBuffered(apiKey: string): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(togetherPayload(false)),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`direct buffered failed: ${response.status} ${text.slice(0, 500)}`);
  }
  return performance.now() - started;
}

async function proxyBuffered(proxyUrl: string, authToken: string): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${proxyUrl}/v1/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${authToken}`, "content-type": "application/json" },
    body: JSON.stringify(claudePayload(false)),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`proxy buffered failed: ${response.status} ${text.slice(0, 500)}`);
  }
  return performance.now() - started;
}

async function directStream(apiKey: string): Promise<StreamTiming> {
  const started = performance.now();
  const response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(togetherPayload(true)),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `direct stream failed: ${response.status} ${(await response.text()).slice(0, 500)}`,
    );
  }
  return await readStreamTiming(response, started, "data:");
}

async function proxyStream(proxyUrl: string, authToken: string): Promise<StreamTiming> {
  const started = performance.now();
  const response = await fetch(`${proxyUrl}/v1/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${authToken}`, "content-type": "application/json" },
    body: JSON.stringify(claudePayload(true)),
  });
  if (!response.ok || !response.body) {
    throw new Error(
      `proxy stream failed: ${response.status} ${(await response.text()).slice(0, 500)}`,
    );
  }
  return await readStreamTiming(response, started, "content_block_delta");
}

async function readStreamTiming(
  response: Response,
  started: number,
  firstMarker: string,
): Promise<StreamTiming> {
  if (!response.body) {
    throw new Error("missing stream body");
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
    if (ttftMs === undefined && text.includes(firstMarker)) {
      ttftMs = performance.now() - started;
    }
  }
  text += decoder.decode();

  if (ttftMs === undefined) {
    throw new Error(`stream never emitted ${firstMarker}: ${text.slice(0, 500)}`);
  }
  return { totalMs: performance.now() - started, ttftMs };
}

function togetherPayload(stream: boolean): Record<string, unknown> {
  return {
    model: GLM_5_2.id,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    max_tokens: 12,
    temperature: 0,
    stream,
  };
}

function claudePayload(stream: boolean): Record<string, unknown> {
  return {
    model: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    max_tokens: 12,
    temperature: 0,
    stream,
  };
}

async function resolveTogetherApiKey(): Promise<string> {
  const envKey = process.env.TOGETHER_API_KEY?.trim();
  if (envKey) {
    return envKey;
  }
  const envFile = await readFile(path.join(repoRoot, ".env"), "utf8").catch(() => "");
  const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith("TOGETHER_API_KEY="));
  const key = line?.slice("TOGETHER_API_KEY=".length).trim() ?? "";
  if (!key) {
    throw new Error("TOGETHER_API_KEY is not set and was not found in .env");
  }
  return key;
}

function summarizeProxyPerf(payloads: ProxyPerfPayload[]): Record<string, unknown> {
  const byName = new Map<string, ProxyPerfPayload[]>();
  for (const payload of payloads) {
    const rows = byName.get(payload.name) ?? [];
    rows.push(payload);
    byName.set(payload.name, rows);
  }

  return Object.fromEntries(
    [...byName].map(([name, rows]) => [
      name,
      {
        total: summarize(
          `${name}-proxy-total`,
          rows.map((row) => row.totalMs),
        ),
        spans: summarizeSpanDurations(rows),
        firstDelta: summarizeMarks(rows, "first-delta"),
      },
    ]),
  );
}

function summarizeSpanDurations(rows: ProxyPerfPayload[]): Record<string, BenchmarkRow> {
  const durations = new Map<string, number[]>();
  for (const row of rows) {
    for (const span of row.spans) {
      const values = durations.get(span.name) ?? [];
      values.push(span.durationMs);
      durations.set(span.name, values);
    }
  }
  return Object.fromEntries(
    [...durations].map(([name, values]) => [name, summarize(name, values)]),
  );
}

function summarizeMarks(rows: ProxyPerfPayload[], name: string): BenchmarkRow | undefined {
  const values = rows.flatMap((row) =>
    row.marks.filter((mark) => mark.name === name).map((mark) => mark.atMs),
  );
  return values.length > 0 ? summarize(name, values) : undefined;
}

function summarize(name: string, values: number[]): BenchmarkRow {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    name,
    iterations: sorted.length,
    minMs: round(sorted[0] ?? 0),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    meanMs: round(sum / sorted.length),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function positiveInt(value: string | undefined): number | undefined {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

type BenchmarkRow = {
  name: string;
  iterations: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
  maxMs: number;
};

type StreamTiming = {
  totalMs: number;
  ttftMs: number;
};
