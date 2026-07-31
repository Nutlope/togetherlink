import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TogetherResponseHeaderTimeoutError,
  postChatCompletion,
  postChatCompletionStream,
} from "../../cli/src/lib/together-client.js";
import { resolveRequestDiagnosticsPath } from "../../cli/src/lib/request-diagnostics.js";

const togetherOptions = () => ({ apiKey: "redacted", fetch: globalThis.fetch });

describe("Together response-header timeout", () => {
  let temporaryHome: string | undefined;

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (temporaryHome) {
      await rm(temporaryHome, { recursive: true, force: true });
      temporaryHome = undefined;
    }
  });

  test("keeps one default admission attempt alive for slow response headers", async () => {
    vi.useFakeTimers();
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_RETRIES", "");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "");
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const responseTimer = setTimeout(
            () => resolve(new Response("ok", { status: 200 })),
            90_000,
          );
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(responseTimer);
              reject(init.signal?.reason);
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      togetherOptions(),
    ).catch((caught: unknown) => caught);

    await vi.advanceTimersByTimeAsync(89_999);
    let settled = false;
    void pending.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("isolates every upstream attempt from the process-global connection pool", async () => {
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await postChatCompletion(
      { model: "fault-injection", messages: [], stream: false },
      togetherOptions(),
    );
    await postChatCompletion(
      { model: "fault-injection", messages: [], stream: false },
      togetherOptions(),
    );

    const firstInit = fetchMock.mock.calls[0]?.[1] as
      | (RequestInit & { dispatcher?: unknown })
      | undefined;
    const secondInit = fetchMock.mock.calls[1]?.[1] as
      | (RequestInit & { dispatcher?: unknown })
      | undefined;
    expect(firstInit?.dispatcher).toBeDefined();
    expect(secondInit?.dispatcher).toBeDefined();
    expect(secondInit?.dispatcher).not.toBe(firstInit?.dispatcher);
  });

  test("uses the owned Node transport even when process-global fetch is broken", async () => {
    let connectionHeader: string | undefined;
    const server = http.createServer((request, response) => {
      connectionHeader = request.headers.connection;
      request.resume();
      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end('{"id":"ok"}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind");
    }
    const brokenGlobalFetch = vi.fn(async () => {
      throw new TypeError("poisoned global fetch");
    });
    vi.stubGlobal("fetch", brokenGlobalFetch);

    try {
      const response = await postChatCompletion(
        { model: "fault-injection", messages: [], stream: false },
        {
          apiKey: "redacted",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "ok" });
      expect(brokenGlobalFetch).not.toHaveBeenCalled();
      expect(connectionHeader).toBe("close");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  test("rejects a fetch that never returns headers with a typed, persisted diagnostic", async () => {
    temporaryHome = await mkdtemp(path.join(os.tmpdir(), "togetherlink-timeout-test-"));
    vi.stubEnv("TOGETHERLINK_HOME", temporaryHome);
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "0");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      ),
    );

    const error = await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      togetherOptions(),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TogetherResponseHeaderTimeoutError);
    expect(error).toMatchObject({ name: "TogetherResponseHeaderTimeoutError", timeoutMs: 100 });
    expect((error as Error).message).toContain("client request ID");

    const diagnostics = await readFile(resolveRequestDiagnosticsPath(temporaryHome), "utf8");
    const persisted = JSON.parse(diagnostics.trim()) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      phase: "response_headers",
      reason: "timeout",
      timeoutMs: 100,
    });
    expect(persisted.clientRequestId).toBe((error as TogetherResponseHeaderTimeoutError).requestId);
    expect(persisted).not.toHaveProperty("apiKey");
  });

  test("preserves a caller abort without retrying it as a transport timeout", async () => {
    temporaryHome = await mkdtemp(path.join(os.tmpdir(), "togetherlink-abort-test-"));
    vi.stubEnv("TOGETHERLINK_HOME", temporaryHome);
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "1000");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();
    setTimeout(() => caller.abort(new DOMException("Caller timed out", "AbortError")), 25);

    const error = await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      togetherOptions(),
      caller.signal,
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ name: "AbortError", message: "Caller timed out" });
    expect(error).not.toBeInstanceOf(TogetherResponseHeaderTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const diagnostics = await readFile(resolveRequestDiagnosticsPath(temporaryHome), "utf8");
    expect(JSON.parse(diagnostics.trim())).toMatchObject({
      phase: "response_headers",
      reason: "caller_abort",
    });
  });

  test("keeps caller cancellation connected after response headers arrive", async () => {
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    let upstreamSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamSignal = init?.signal ?? undefined;
        return new Response(hangingBody(), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );
    const caller = new AbortController();

    await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      togetherOptions(),
      caller.signal,
    );
    caller.abort(new DOMException("Client disconnected", "AbortError"));

    expect(upstreamSignal?.aborted).toBe(true);
  });

  test("logs successful upstream response headers in debug mode without request credentials", async () => {
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("data: [DONE]\n\n", {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-cache-status": "HIT",
            "x-request-id": "upstream-request-123",
          },
        });
      }),
    );

    await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      {
        ...togetherOptions(),
        apiKey: "secret-never-log",
        baseUrl: "https://together.test/v1",
        debug: true,
      },
    );

    const headerLog = stderr.mock.calls
      .map(([value]) => String(value))
      .find((line) => line.includes("together response headers"));
    expect(headerLog).toBeDefined();
    expect(headerLog).toContain('"status":200');
    expect(headerLog).toContain('"x-cache-status":"HIT"');
    expect(headerLog).toContain('"x-request-id":"upstream-request-123"');
    expect(headerLog).toContain('"upstreamUrl":"https://together.test/v1/chat/completions"');
    expect(headerLog).not.toContain("secret-never-log");
    expect(headerLog).not.toContain("Authorization");
  });

  test("limits non-stream response-header timeouts to one safe retry", async () => {
    temporaryHome = await mkdtemp(path.join(os.tmpdir(), "togetherlink-buffered-timeout-test-"));
    vi.stubEnv("TOGETHERLINK_HOME", temporaryHome);
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_RETRIES", "1");
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await postChatCompletion(
      { model: "fault-injection", messages: [], stream: false },
      togetherOptions(),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TogetherResponseHeaderTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function hangingBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    cancel() {
      // Caller cancellation should reach this body through fetch's signal.
    },
  });
}
