import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "../../models/src/index.js";
import { handleProxyRequest, type ModelDefinition } from "../../cli/src/lib/claude/proxy.js";
import type { ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("Claude proxy compatibility API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

class MemoryResponse extends EventEmitter {
  status = 200;
  body = "";
  writableEnded = false;

  writeHead(status: number): this {
    this.status = status;
    return this;
  }

  end(chunk?: unknown): this {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    this.writableEnded = true;
    return this;
  }
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
