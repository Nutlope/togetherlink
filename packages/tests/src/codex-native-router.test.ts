import http from "node:http";
import * as zlib from "node:zlib";
import { describe, expect, test } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";
import {
  DEFAULT_CODEX_NATIVE_BASE_URL,
  nativeCodexBaseUrl,
  readDecodedCodexRequest,
} from "../../cli/src/lib/codex/native-router.js";

const realFetch = globalThis.fetch.bind(globalThis);
const compressionCases: Array<[string, (input: Buffer) => Buffer]> = [
  ["gzip", zlib.gzipSync],
  ["deflate", zlib.deflateSync],
  ["br", zlib.brotliCompressSync],
];
if (typeof zlib.zstdCompressSync === "function") {
  compressionCases.push(["zstd", zlib.zstdCompressSync]);
}

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

  test("strips store:false so Together-minted item ids in replayed input resolve upstream", async () => {
    const upstream: Array<Record<string, unknown>> = [];
    const response = await requestProxy(
      {
        model: "gpt-5.6-sol",
        store: false,
        input: [
          // Minted by the Together proxy on an earlier turn (translate-response.ts);
          // the native backend cannot resolve it when store is false.
          {
            id: "rs_3fe9445861074864aede0b7de5e61afa",
            type: "reasoning",
            summary: [],
            content: [],
          },
          { type: "message", role: "user", content: "continue" },
        ],
      },
      { Authorization: "Bearer chatgpt-oauth" },
      async (_url, init) => {
        upstream.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse({ id: "native-response", status: "completed" });
      },
    );

    expect(response.status).toBe(200);
    expect(upstream[0]?.store).toBeUndefined();
  });

  test("preserves native endpoint query strings", async () => {
    let upstreamUrl: string | undefined;
    const response = await requestProxy(
      { prompt: "draw a fox" },
      { authorization: "Bearer chatgpt-oauth" },
      async (url) => {
        upstreamUrl = url;
        return jsonResponse({ data: [] });
      },
      "/v1/images/generations?intent=background&quality=high",
    );

    expect(response.status).toBe(200);
    expect(upstreamUrl).toBe(
      "https://chatgpt.test/backend-api/codex/images/generations?intent=background&quality=high",
    );
  });

  test("forwards the Codex image turn id to native image endpoints", async () => {
    let upstreamHeaders: Headers | undefined;
    const response = await requestProxy(
      { prompt: "edit the sky" },
      {
        authorization: "Bearer chatgpt-oauth",
        "x-codex-image-turn-id": "turn_image_123",
      },
      async (_url, init) => {
        upstreamHeaders = new Headers(init.headers);
        return jsonResponse({ data: [] });
      },
      "/v1/images/edits",
    );

    expect(response.status).toBe(200);
    expect(upstreamHeaders?.get("x-codex-image-turn-id")).toBe("turn_image_123");
  });

  test("forwards the Codex memory-generation request header to native endpoints", async () => {
    let upstreamHeaders: Headers | undefined;
    const response = await requestProxy(
      { model: "gpt-5.6-sol", input: "summarize memory" },
      {
        authorization: "Bearer chatgpt-oauth",
        "x-openai-memgen-request": "memory-request-123",
        "x-openai-internal-codex-responses-lite": "1",
        version: "0.200.0",
      },
      async (_url, init) => {
        upstreamHeaders = new Headers(init.headers);
        return jsonResponse({ status: "completed" });
      },
    );

    expect(response.status).toBe(200);
    expect(upstreamHeaders?.get("x-openai-memgen-request")).toBe("memory-request-123");
    expect(upstreamHeaders?.get("x-openai-internal-codex-responses-lite")).toBe("1");
    expect(upstreamHeaders?.get("version")).toBe("0.200.0");
  });

  test("blocks native Set-Cookie headers while preserving safe response headers", async () => {
    const response = await requestProxy(
      { prompt: "draw a fox" },
      { authorization: "Bearer chatgpt-oauth" },
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "https://chatgpt.test/result/image-123",
            "set-cookie": "chatgpt_session=must-not-cross; HttpOnly",
            "x-request-id": "request-123",
          },
        }),
      "/v1/images/generations",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBe("https://chatgpt.test/result/image-123");
    expect(response.headers.get("x-request-id")).toBe("request-123");
  });

  test.runIf(typeof zlib.zstdCompressSync === "function")(
    "decodes zstd desktop requests before native forwarding",
    async () => {
      if (typeof zlib.zstdCompressSync !== "function") {
        throw new Error("zstd compression is unavailable in this test runtime");
      }
      let upstreamBody: Record<string, unknown> | undefined;
      const body = Buffer.from(JSON.stringify({ model: "gpt-5.6-terra", input: "compressed" }));
      const response = await requestProxyBytes(
        zlib.zstdCompressSync(body),
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
    },
  );

  test("rejects encoded request bodies over the configured bound with HTTP 413", async () => {
    const response = await requestDecodedBody(
      Buffer.from(JSON.stringify({ input: "x".repeat(256) })),
      { "content-type": "application/json" },
      { maxEncodedBytes: 128, maxDecodedBytes: 1_024 },
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { type: "request_too_large", message: "Codex request body is too large." },
    });
  });

  test.each(compressionCases)(
    "rejects %s requests whose decoded body exceeds the configured bound",
    async (contentEncoding, compress) => {
      const encoded = compress(Buffer.from(JSON.stringify({ input: "x".repeat(2_048) })));
      expect(encoded.length).toBeLessThan(1_024);

      const response = await requestDecodedBody(
        encoded,
        { "content-type": "application/json", "content-encoding": contentEncoding },
        { maxEncodedBytes: 1_024, maxDecodedBytes: 256 },
      );

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({
        error: { type: "request_too_large", message: "Decoded Codex request body is too large." },
      });
    },
  );

  test("rejects unsupported request compression with HTTP 415", async () => {
    const response = await requestDecodedBody(
      Buffer.from(JSON.stringify({ input: "hello" })),
      { "content-type": "application/json", "content-encoding": "compress" },
      { maxEncodedBytes: 1_024, maxDecodedBytes: 1_024 },
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: {
        type: "invalid_request_error",
        message: "Unsupported Codex request Content-Encoding: compress.",
      },
    });
  });

  test("rejects malformed JSON without echoing request contents", async () => {
    const response = await requestDecodedBody(
      Buffer.from('{"secret":"must-not-leak", broken}'),
      { "content-type": "application/json" },
      { maxEncodedBytes: 1_024, maxDecodedBytes: 1_024 },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, any>;
    expect(body).toEqual({
      error: {
        type: "invalid_request_error",
        message: "Codex request body must contain valid JSON.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
  });

  test("rejects corrupt compressed bodies with a sanitized HTTP 400", async () => {
    const response = await requestDecodedBody(
      Buffer.from("not-a-gzip-stream"),
      { "content-type": "application/json", "content-encoding": "gzip" },
      { maxEncodedBytes: 1_024, maxDecodedBytes: 1_024 },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        type: "invalid_request_error",
        message: "Codex request body compression is invalid.",
      },
    });
  });

  test("rejects non-object JSON request roots with HTTP 400", async () => {
    const response = await requestDecodedBody(
      Buffer.from("null"),
      { "content-type": "application/json" },
      { maxEncodedBytes: 1_024, maxDecodedBytes: 1_024 },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        type: "invalid_request_error",
        message: "Codex request body must be a JSON object.",
      },
    });
  });

  test("sanitizes foreign plaintext reasoning before native replay without losing native or TogetherLink state", async () => {
    let upstreamBody: Record<string, unknown> | undefined;
    const ownedSummary = `tlc1:${Buffer.from("Continue from TogetherLink checkpoint.").toString("base64")}`;
    const response = await requestProxy(
      {
        model: "gpt-5.6-sol",
        input: [
          {
            type: "reasoning",
            id: "foreign-reasoning",
            summary: [{ type: "summary_text", text: "Readable summary remains." }],
            encrypted_content: "This is plaintext reasoning from another provider.",
          },
          {
            type: "reasoning",
            id: "native-reasoning",
            summary: [],
            encrypted_content: "gAAAAABkZmtM7cT9w_XY_zThisIsAnOpaqueBlobWithNoWhitespace",
          },
          { type: "compaction", encrypted_content: ownedSummary },
        ],
      },
      { authorization: "Bearer chatgpt-oauth" },
      async (_url, init) => {
        upstreamBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse({ status: "completed" });
      },
    );

    expect(response.status).toBe(200);
    const sent = upstreamBody?.input as Array<Record<string, unknown>>;
    expect(sent[0]).toMatchObject({
      type: "reasoning",
      id: "foreign-reasoning",
      summary: [{ type: "summary_text", text: "Readable summary remains." }],
    });
    expect(sent[0]).not.toHaveProperty("encrypted_content");
    expect(sent[1]?.encrypted_content).toBe(
      "gAAAAABkZmtM7cT9w_XY_zThisIsAnOpaqueBlobWithNoWhitespace",
    );
    expect(sent[2]).toMatchObject({ type: "message", role: "user" });
    expect(JSON.stringify(sent[2])).toContain("Continue from TogetherLink checkpoint.");
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
  path = "/v1/responses",
): Promise<Response> {
  return requestProxyBytes(
    Buffer.from(JSON.stringify(body)),
    { "content-type": "application/json", ...headers },
    upstreamFetch,
    path,
  );
}

async function requestProxyBytes(
  body: Buffer,
  headers: Record<string, string>,
  upstreamFetch: (input: string, init: RequestInit) => Promise<Response>,
  path = "/v1/responses",
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
    return await realFetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
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

async function requestDecodedBody(
  body: Buffer,
  headers: Record<string, string>,
  limits: { maxEncodedBytes: number; maxDecodedBytes: number },
): Promise<Response> {
  const server = http.createServer((req, res) => {
    readDecodedCodexRequest(req, limits)
      .then(() => {
        res.writeHead(204);
        res.end();
      })
      .catch((error: unknown) => {
        const status =
          error instanceof Error && "status" in error && typeof error.status === "number"
            ? error.status
            : 500;
        res.writeHead(status, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              type: status === 413 ? "request_too_large" : "invalid_request_error",
              message: error instanceof Error ? error.message : String(error),
            },
          }),
        );
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
