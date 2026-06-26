import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2, VISION_MODELS } from "../../models/src/index.js";
import { handleProxyRequest, type ModelDefinition } from "../../cli/src/lib/claude/proxy.js";
import type { ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const EXPECTED_HAIKU_PROFILE_MODEL_ID = VISION_MODELS[1]?.id ?? VISION_MODELS[0]?.id ?? GLM_5_2.id;

describe("Claude proxy compatibility API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("returns metadata for a supported model id", async () => {
    const response = await callClaudeProxy({
      method: "GET",
      url: `/v1/models/${encodeURIComponent(GLM_5_2.id)}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(GLM_5_2.anthropicAlias);
    expect(response.body.max_input_tokens).toBeLessThan(GLM_5_2.limit.context);
    expect(response.body.max_tokens).toBe(GLM_5_2.limit.output);
  });

  test("counts tokens without calling the upstream model", async () => {
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages/count_tokens",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        messages: [{ role: "user", content: "Hello, world" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.input_tokens).toBe("number");
    expect(response.body.input_tokens).toBeGreaterThan(0);
  });

  test("count_tokens does not hide prompts that exceed the advertised safe input limit", async () => {
    const hugePrompt = "oversized context ".repeat(70_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages/count_tokens",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        messages: [{ role: "user", content: hugePrompt }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.input_tokens).toBeGreaterThan(GLM_5_2.limit.context - 4096);
  });

  test("trims Claude compaction-sized input before sacrificing the summary budget", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      upstreamBodies.push(body);
      return new Response(JSON.stringify({
        id: "chatcmpl_budgeted",
        choices: [{ message: { content: "BUDGETED_OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 259_000, completion_tokens: 1, total_tokens: 259_001 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const nearFullContext = "context budget pressure ".repeat(44_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        messages: [{ role: "user", content: nearFullContext }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "BUDGETED_OK" }]);
    expect(upstreamBodies).toHaveLength(1);
    const upstreamContent = firstUserContent(upstreamBodies[0]);
    expect(typeof upstreamContent).toBe("string");
    if (typeof upstreamContent !== "string") {
      throw new Error("expected upstream user content to be a string");
    }
    expect(upstreamContent).toContain("[togetherlink trimmed older context to fit the model window]");
    expect(upstreamContent.length).toBeLessThan(nearFullContext.length);
    expect(upstreamBodies[0]?.max_tokens).toBeGreaterThanOrEqual(16_000);
  });

  test("uses compact thinking signatures instead of echoing full reasoning", async () => {
    const longReasoning = "reasoning trace ".repeat(10_000);
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({
        id: "chatcmpl_reasoning_signature",
        choices: [{ message: { reasoning: longReasoning, content: "SIGNATURE_OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 10_000, total_tokens: 10_010 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000 },
        messages: [{ role: "user", content: "Think briefly." }],
      }),
    });

    expect(response.status).toBe(200);
    const content = response.body.content as Array<Record<string, unknown>>;
    expect(content[0]?.type).toBe("thinking");
    expect(content[0]?.thinking).toBe(longReasoning);
    expect(String(content[0]?.signature)).toMatch(/^togetherlink:[a-f0-9]{16}$/);
    expect(String(content[0]?.signature).length).toBeLessThan(40);
  });

  test("recovers from Together input-over-context errors by trimming old prompt text", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      upstreamBodies.push(body);
      if (upstreamBodies.length === 1) {
        return new Response(JSON.stringify({
          error: {
            message:
              "This model's maximum context length is 262144 tokens, but the request resolved to 262323 input tokens (including image/vision expansion). Reduce the input length, image resolution, or the number of images.",
          },
        }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        id: "chatcmpl_trimmed",
        choices: [{ message: { content: "TRIMMED_CONTEXT_OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 262000, completion_tokens: 3, total_tokens: 262003 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const oldContext = "old context ".repeat(20_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 1024,
        messages: [
          { role: "user", content: oldContext },
          { role: "user", content: "Please answer with TRIMMED_CONTEXT_OK." },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "TRIMMED_CONTEXT_OK" }]);
    expect(upstreamBodies).toHaveLength(2);
    const firstContent = firstUserContent(upstreamBodies[0]);
    const secondContent = firstUserContent(upstreamBodies[1]);
    expect(typeof firstContent).toBe("string");
    expect(typeof secondContent).toBe("string");
    if (typeof firstContent !== "string" || typeof secondContent !== "string") {
      throw new Error("expected upstream user content to be strings");
    }
    expect(secondContent.length).toBeLessThan(firstContent.length);
    expect(secondContent).toContain("[togetherlink trimmed older context to fit the model window]");
  });

  test("routes Claude Code Explore subagents through the lightweight Haiku-like profile", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      upstreamBodies.push(body);
      return sseResponse([
        {
          choices: [{ delta: { content: "EXPLORE_OK" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 3, total_tokens: 103 },
        },
      ]);
    }));

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 64_000,
        thinking: { type: "enabled", budget_tokens: 64_000 },
        system:
          "x-anthropic-billing-header: cc_version=2.1.193; cc_entrypoint=cli; cc_is_subagent=true; cc_subagent_name=Explore; cc_model=haiku;\n" +
          "You are Claude Code. You are a file search specialist for Claude Code.",
        messages: [{ role: "user", content: "Find the relevant files." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("EXPLORE_OK");
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: EXPECTED_HAIKU_PROFILE_MODEL_ID,
      max_tokens: 4096,
      chat_template_kwargs: { clear_thinking: true },
      stream: true,
    });
    expect(upstreamBodies[0]?.reasoning_effort).toBeUndefined();
  });

  test("keeps normal Claude requests on the selected GLM reasoning profile", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      upstreamBodies.push(body);
      return new Response(JSON.stringify({
        id: "chatcmpl_normal",
        choices: [{ message: { content: "NORMAL_OK" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 64_000,
        thinking: { type: "enabled", budget_tokens: 64_000 },
        messages: [{ role: "user", content: "Think carefully." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "NORMAL_OK" }]);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: GLM_5_2.id,
      max_tokens: 64_000,
      reasoning_effort: "max",
      chat_template_kwargs: { clear_thinking: false },
      stream: false,
    });
  });
});

function firstUserContent(body: Record<string, unknown> | undefined): unknown {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const userMessage = messages.find((message) => {
    return typeof message === "object" && message !== null && (message as { role?: unknown }).role === "user";
  });
  return typeof userMessage === "object" && userMessage !== null ? (userMessage as { content?: unknown }).content : undefined;
}

async function callClaudeProxy({
  method,
  url,
  body,
}: {
  method: string;
  url: string;
  body?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const req = Readable.from(body ? [body] : []) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { authorization: "Bearer local-token" };
  const res = new MemoryResponse() as unknown as ServerResponse;

  await handleProxyRequest(req, res, proxyOptions());

  const memoryRes = res as unknown as MemoryResponse;
  return {
    status: memoryRes.status,
    body: JSON.parse(memoryRes.body || "{}") as Record<string, unknown>,
  };
}

async function callClaudeProxyRaw({
  method,
  url,
  body,
}: {
  method: string;
  url: string;
  body?: string;
}): Promise<{ status: number; body: string }> {
  const req = Readable.from(body ? [body] : []) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { authorization: "Bearer local-token" };
  const res = new MemoryResponse() as unknown as ServerResponse;

  await handleProxyRequest(req, res, proxyOptions());

  const memoryRes = res as unknown as MemoryResponse;
  return {
    status: memoryRes.status,
    body: memoryRes.body,
  };
}

class MemoryResponse extends EventEmitter {
  status = 200;
  body = "";
  writableEnded = false;

  writeHead(status: number): this {
    this.status = status;
    return this;
  }

  write(chunk?: unknown): boolean {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    return true;
  }

  end(chunk?: unknown): this {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    this.writableEnded = true;
    return this;
  }
}

function sseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function proxyOptions(): ClaudeProxyOptions {
  return {
    apiKey: "test-together-key",
    modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
    targetModelId: GLM_5_2.id,
    modelName: GLM_5_2.name,
    modelDefinition: GLM_5_2 as ModelDefinition,
    authToken: "local-token",
  };
}
