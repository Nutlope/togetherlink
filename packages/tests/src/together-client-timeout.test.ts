import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TogetherResponseHeaderTimeoutError,
  postChatCompletion,
  postChatCompletionStream,
} from "../../cli/src/lib/together-client.js";
import { resolveRequestDiagnosticsPath } from "../../cli/src/lib/request-diagnostics.js";

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

  test("defaults to 30 seconds before rejecting a response-header stall", async () => {
    vi.useFakeTimers();
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_RETRIES", "0");
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

    const pending = postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      { apiKey: "redacted" },
    ).catch((caught: unknown) => caught);

    await vi.advanceTimersByTimeAsync(29_999);
    let settled = false;
    void pending.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({
      name: "TogetherResponseHeaderTimeoutError",
      timeoutMs: 30_000,
    });
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
      { apiKey: "redacted" },
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
      { apiKey: "redacted" },
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
      { apiKey: "redacted" },
      caller.signal,
    );
    caller.abort(new DOMException("Client disconnected", "AbortError"));

    expect(upstreamSignal?.aborted).toBe(true);
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
      { apiKey: "redacted" },
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
