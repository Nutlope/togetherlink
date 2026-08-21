import * as http from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";
import { CostTracker } from "../../cli/src/lib/cost.js";

const realFetch = globalThis.fetch.bind(globalThis);

const options: CodexProxyOptions = {
  apiKey: "test-together-key",
  baseUrl: "https://api.together.ai/v1",
  modelId: GLM_5_2.id,
  targetModelId: GLM_5_2.id,
  modelName: GLM_5_2.name,
  modelDefinition: GLM_5_2,
  authToken: "test-token",
};

describe("Codex memory summarization compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("summarizes every Together trace into the exact Codex output shape in trace order", async () => {
    const upstreamBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body)) as Record<string, any>;
        upstreamBodies.push(body);
        const traceId = JSON.stringify(body.messages).includes("trace-blue")
          ? "trace-blue"
          : "trace-orange";
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  trace_summary: `${traceId} raw summary`,
                  memory_summary: `${traceId} durable memory`,
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        });
      }),
    );

    const result = await postCodexPath("/v1/memories/trace_summarize", {
      model: GLM_5_2.id,
      reasoning: { effort: "high" },
      traces: [
        {
          id: "trace-blue",
          metadata: { source_path: "/tmp/blue.jsonl" },
          items: [{ type: "message", role: "user", content: "Remember blue." }],
        },
        {
          id: "trace-orange",
          metadata: { source_path: "/tmp/orange.jsonl" },
          items: [{ type: "message", role: "assistant", content: "Remember orange." }],
        },
      ],
    });

    expect(result).toEqual({
      output: [
        {
          trace_summary: "trace-blue raw summary",
          memory_summary: "trace-blue durable memory",
        },
        {
          trace_summary: "trace-orange raw summary",
          memory_summary: "trace-orange durable memory",
        },
      ],
    });
    expect(upstreamBodies).toHaveLength(2);
    expect(upstreamBodies.map((body) => body.model)).toEqual([GLM_5_2.id, GLM_5_2.id]);
    for (const body of upstreamBodies) {
      expect(body.stream).toBe(false);
      expect(body.tools).toEqual([]);
      expect(body.tool_choice).toBe("none");
      expect(body.max_tokens).toBeGreaterThan(0);
      expect(body.max_tokens).toBeLessThanOrEqual(4_096);
      expect(body.reasoning_effort).toBe("max");
    }
    expect(JSON.stringify(upstreamBodies[0]?.messages)).toContain("/tmp/blue.jsonl");
    expect(JSON.stringify(upstreamBodies[1]?.messages)).toContain("/tmp/orange.jsonl");
  });

  test("rejects malformed traces before sending anything upstream", async () => {
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      url.startsWith("http://127.0.0.1:") ? realFetch(url, init) : upstream(url, init),
    );

    const response = await postCodexResponse("/v1/memories/trace_summarize", {
      model: GLM_5_2.id,
      traces: [{ id: "broken", metadata: {}, items: "not-an-array" }],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        type: "invalid_request_error",
        message: "traces[0] must contain a string id, metadata.source_path, and an items array",
      },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  test("returns an empty output without calling Together when Codex sends no traces", async () => {
    const upstream = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({}));
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      url.startsWith("http://127.0.0.1:") ? realFetch(url, init) : upstream(url, init),
    );

    for (const path of ["/v1/memories/trace_summarize", "/memories/trace_summarize"]) {
      const result = await postCodexPath(path, {
        model: GLM_5_2.id,
        traces: [],
      });
      expect(result).toEqual({ output: [] });
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  test("forwards native GPT memory summarization to ChatGPT unchanged", async () => {
    const nativeRequests: Array<{ url: string; method: string | undefined; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        nativeRequests.push({
          url,
          method: init?.method,
          body: JSON.parse(String(init?.body)),
        });
        return jsonResponse({
          output: [{ trace_summary: "native trace", memory_summary: "native memory" }],
        });
      }),
    );
    const requestBody = {
      model: "gpt-5.6-sol",
      reasoning: { effort: "xhigh" },
      traces: [
        {
          id: "native-trace",
          metadata: { source_path: "/tmp/native.jsonl" },
          items: [{ type: "message", role: "user", content: "Native memory." }],
        },
      ],
    };

    const result = await postCodexPath("/v1/memories/trace_summarize", requestBody, {
      ...options,
      nativeBaseUrl: "https://chatgpt.com/backend-api/codex",
    });

    expect(result).toEqual({
      output: [{ trace_summary: "native trace", memory_summary: "native memory" }],
    });
    expect(nativeRequests).toEqual([
      {
        url: "https://chatgpt.com/backend-api/codex/memories/trace_summarize",
        method: "POST",
        body: requestBody,
      },
    ]);
  });

  test("does not recalibrate the turn estimator from one trace in a multi-trace request", async () => {
    const costTracker = new CostTracker(GLM_5_2);
    costTracker.noteRequestBytes(1_000);
    costTracker.beginRequest();
    costTracker.addUsage(100, 0, 0, GLM_5_2);
    expect(costTracker.tokenEstimator.estimate(1_000)).toBe(100);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) return realFetch(url, init);
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  trace_summary: "trace",
                  memory_summary: "memory",
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
        });
      }),
    );

    await postCodexPath(
      "/v1/memories/trace_summarize",
      {
        model: GLM_5_2.id,
        traces: [
          memoryTrace("large-a", "a".repeat(10_000)),
          memoryTrace("large-b", "b".repeat(10_000)),
        ],
      },
      { ...options, costTracker },
    );

    expect(costTracker.tokenEstimator.estimate(1_000)).toBe(100);
    expect(costTracker.totals.promptTokens).toBe(300);
  });

  test("records completed trace usage when a later memory trace fails", async () => {
    const costTracker = new CostTracker(GLM_5_2);
    let upstreamCall = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) return realFetch(url, init);
        upstreamCall += 1;
        if (upstreamCall === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    trace_summary: "first trace",
                    memory_summary: "first memory",
                  }),
                },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
          });
        }
        return new Response(JSON.stringify({ error: { message: "second trace failed" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const response = await postCodexResponse(
      "/v1/memories/trace_summarize",
      {
        model: GLM_5_2.id,
        traces: [memoryTrace("first", "one"), memoryTrace("second", "two")],
      },
      { ...options, costTracker },
    );

    expect(response.status).toBe(500);
    expect(costTracker.totals.promptTokens).toBe(20);
    expect(costTracker.totals.completionTokens).toBe(5);
  });
});

function memoryTrace(id: string, text: string): Record<string, unknown> {
  return {
    id,
    metadata: { source_path: `/tmp/${id}.jsonl` },
    items: [{ type: "message", role: "user", content: text }],
  };
}

async function postCodexPath(
  path: string,
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<Record<string, any>> {
  const response = await postCodexResponse(path, body, proxyOptions);
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, any>;
}

async function postCodexResponse(
  path: string,
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<Response> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, { ...proxyOptions, fetch: globalThis.fetch }).catch(
      (error) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("test server did not bind");
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const buffered = new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    return buffered;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
