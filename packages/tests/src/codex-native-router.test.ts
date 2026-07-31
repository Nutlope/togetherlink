import http from "node:http";
import { zstdCompressSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";
import {
  DEFAULT_CODEX_NATIVE_BASE_URL,
  nativeCodexBaseUrl,
} from "../../cli/src/lib/codex/native-router.js";

const realFetch = globalThis.fetch.bind(globalThis);

const baseOptions: CodexProxyOptions = {
  apiKey: "together-secret",
  baseUrl: "https://together.test/v1",
  modelId: GLM_5_2.id,
  targetModelId: GLM_5_2.id,
  modelName: GLM_5_2.name,
  modelDefinition: GLM_5_2,
  authToken: "local-token",
  nativeBaseUrl: "https://chatgpt.test/backend-api/codex",
};

describe("Codex additive native/Together router", () => {
  test("forwards GPT requests with ChatGPT auth while filtering unrelated headers", async () => {
    const upstream: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const response = await requestProxy(
      {
        model: "gpt-5.6-sol",
        previous_response_id: "must-not-cross-local-resume",
        input: "native",
      },
      {
        Authorization: "Bearer chatgpt-oauth",
        "ChatGPT-Account-Id": "account-123",
        "X-Codex-Installation-Id": "install-456",
        "X-Private-Header": "do-not-forward",
      },
      async (url, init) => {
        upstream.push({
          url,
          headers: new Headers(init.headers),
          body: JSON.parse(String(init.body)) as Record<string, unknown>,
        });
        return jsonResponse({ id: "native-response", status: "completed" });
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "native-response" });
    expect(upstream[0]?.url).toBe("https://chatgpt.test/backend-api/codex/responses");
    expect(upstream[0]?.headers.get("authorization")).toBe("Bearer chatgpt-oauth");
    expect(upstream[0]?.headers.get("chatgpt-account-id")).toBe("account-123");
    expect(upstream[0]?.headers.get("x-codex-installation-id")).toBe("install-456");
    expect(upstream[0]?.headers.get("x-private-header")).toBeNull();
    expect(upstream[0]?.body.previous_response_id).toBeUndefined();
  });

  test("decodes zstd desktop requests before native forwarding", async () => {
    let upstreamBody: Record<string, unknown> | undefined;
    const body = Buffer.from(JSON.stringify({ model: "gpt-5.6-terra", input: "compressed" }));
    const response = await requestProxyBytes(
      zstdCompressSync(body),
      {
        "content-type": "application/json",
        "content-encoding": "zstd",
        authorization: "Bearer chatgpt-oauth",
      },
      async (_url, init) => {
        upstreamBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(new Headers(init.headers).get("content-encoding")).toBeNull();
        return jsonResponse({ status: "completed" });
      },
    );

    expect(response.status).toBe(200);
    expect(upstreamBody).toMatchObject({ model: "gpt-5.6-terra", input: "compressed" });
  });

  test("keeps Together requests on Together and never forwards ChatGPT credentials", async () => {
    const upstream: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const response = await requestProxy(
      { model: GLM_5_2.id, input: "external" },
      {
        authorization: "Bearer chatgpt-oauth",
        "chatgpt-account-id": "account-secret",
      },
      async (url, init) => {
        upstream.push({
          url,
          headers: new Headers(init.headers),
          body: JSON.parse(String(init.body)) as Record<string, unknown>,
        });
        return jsonResponse({
          choices: [{ message: { content: "TOGETHER_OK" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    );

    expect(response.status).toBe(200);
    expect(upstream[0]?.url).toBe("https://together.test/v1/chat/completions");
    expect(upstream[0]?.headers.get("authorization")).toBe("Bearer together-secret");
    expect(upstream[0]?.headers.get("chatgpt-account-id")).toBeNull();
    expect(upstream[0]?.body.model).toBe(GLM_5_2.id);
  });

  test("derives the native backend from an existing ChatGPT base URL", () => {
    expect(nativeCodexBaseUrl("")).toBe(DEFAULT_CODEX_NATIVE_BASE_URL);
    expect(
      nativeCodexBaseUrl('chatgpt_base_url = "https://enterprise.example/backend-api/"\n'),
    ).toBe("https://enterprise.example/backend-api/codex");
  });
});

async function requestProxy(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  upstreamFetch: (input: string, init: RequestInit) => Promise<Response>,
): Promise<Response> {
  return requestProxyBytes(
    Buffer.from(JSON.stringify(body)),
    { "content-type": "application/json", ...headers },
    upstreamFetch,
  );
}

async function requestProxyBytes(
  body: Buffer,
  headers: Record<string, string>,
  upstreamFetch: (input: string, init: RequestInit) => Promise<Response>,
): Promise<Response> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, { ...baseOptions, fetch: upstreamFetch }).catch((error) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  try {
    return await realFetch(`http://127.0.0.1:${address.port}/v1/responses`, {
      method: "POST",
      headers,
      body,
    });
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
