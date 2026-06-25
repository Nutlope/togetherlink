import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, test } from "vitest";
import { GLM_5_2 } from "../../models/src/index.js";
import { handleProxyRequest, type ModelDefinition } from "../../cli/src/lib/claude/proxy.js";
import type { ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("Claude proxy compatibility API", () => {
  test("returns metadata for a supported model id", async () => {
    const response = await callClaudeProxy({
      method: "GET",
      url: `/v1/models/${encodeURIComponent(GLM_5_2.id)}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(GLM_5_2.anthropicAlias);
    expect(response.body.max_input_tokens).toBe(GLM_5_2.limit.context);
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
});

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
