import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { postChatCompletionStream } from "../../cli/src/lib/together-client.js";
import { resolveRequestDiagnosticsPath } from "../../cli/src/lib/request-diagnostics.js";
import { readTogetherSseWithRetry } from "../../cli/src/lib/together-stream.js";

describe("shared Together SSE transport", () => {
  let temporaryHome: string | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (temporaryHome) {
      await rm(temporaryHome, { recursive: true, force: true });
      temporaryHome = undefined;
    }
  });

  test("retries an idle response before harness output starts", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const retry = vi.fn(async () =>
      sseResponse([{ choices: [{ delta: { content: "recovered" } }] }]),
    );

    const events: string[] = [];
    for await (const event of readTogetherSseWithRetry(hangingSseResponse(), retry, {
      isOutputStarted: () => false,
    })) {
      events.push(event.data);
    }

    expect(retry).toHaveBeenCalledTimes(1);
    expect(events.join("\n")).toContain("recovered");
  });

  test("retries a stream that closes before DONE when no harness output started", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const retry = vi.fn(async () =>
      sseResponse([
        { choices: [{ delta: { content: "recovered" } }] },
        { choices: [{ finish_reason: "stop", delta: {} }] },
      ]),
    );

    const events: string[] = [];
    for await (const event of readTogetherSseWithRetry(prematurelyClosedSseResponse([]), retry, {
      isOutputStarted: () => false,
    })) {
      events.push(event.data);
    }

    expect(retry).toHaveBeenCalledTimes(1);
    expect(events.join("\n")).toContain("recovered");
  });

  test("retries a stream whose reader terminates before DONE when no harness output started", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const retry = vi.fn(async () =>
      sseResponse([
        { choices: [{ delta: { content: "recovered after transport termination" } }] },
        { choices: [{ finish_reason: "stop", delta: {} }] },
      ]),
    );

    const events: string[] = [];
    for await (const event of readTogetherSseWithRetry(terminatedSseResponse(), retry, {
      isOutputStarted: () => false,
    })) {
      events.push(event.data);
    }

    expect(retry).toHaveBeenCalledTimes(1);
    expect(events.join("\n")).toContain("recovered after transport termination");
  });

  test("surfaces a terminated reader after harness output starts", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const retry = vi.fn(async () => sseResponse([]));

    const consume = async () => {
      for await (const _event of readTogetherSseWithRetry(terminatedSseResponse(), retry, {
        isOutputStarted: () => true,
      })) {
        // The first chunk represents output already forwarded by the harness.
      }
    };

    await expect(consume()).rejects.toMatchObject({
      name: "TogetherSsePrematureCloseError",
      message: expect.stringContaining("Upstream reader error: terminated."),
      cause: expect.objectContaining({ message: "terminated" }),
    });
    expect(retry).not.toHaveBeenCalled();
  });

  test("retries a transient HTTP 500 before the stream starts", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "temporary worker failure" } }), {
          status: 500,
          headers: { "content-type": "application/json", "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(
        sseResponse([
          { choices: [{ delta: { content: "recovered" } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      { apiKey: "redacted" },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not retry an idle response after harness output starts", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const retry = vi.fn(async () => sseResponse([]));

    const consume = async () => {
      for await (const _event of readTogetherSseWithRetry(hangingSseResponse(), retry, {
        isOutputStarted: () => true,
      })) {
        // The fault-injection stream never emits.
      }
    };

    await expect(consume()).rejects.toMatchObject({ name: "TogetherSseIdleTimeoutError" });
    expect(retry).not.toHaveBeenCalled();
  });

  test("cancels the active stream and never retries after the caller aborts", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_TURN_TIMEOUT_MS", "1000");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    const controller = new AbortController();
    const cancel = vi.fn();
    const retry = vi.fn(async () => sseResponse([]));
    const options = {
      isOutputStarted: () => false,
      signal: controller.signal,
    };

    const consume = async () => {
      for await (const _event of readTogetherSseWithRetry(
        hangingSseResponse(cancel),
        retry,
        options,
      )) {
        // The fault-injection stream never emits.
      }
    };
    const result = consume().then(
      () => undefined,
      (error: unknown) => error,
    );

    await new Promise<void>((resolve) => setImmediate(resolve));
    const abortReason = new Error("client disconnected");
    controller.abort(abortReason);

    expect(await result).toBe(abortReason);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  test("stops a turn that stays active without ever completing", async () => {
    vi.stubEnv("TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS", "1000");
    vi.stubEnv("TOGETHERLINK_STREAM_TURN_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "0");
    const retry = vi.fn(async () => sseResponse([]));

    const consume = async () => {
      for await (const _event of readTogetherSseWithRetry(activeSseResponse(), retry, {
        isOutputStarted: () => false,
      })) {
        // The fault-injection stream stays active but never finishes.
      }
    };

    await expect(consume()).rejects.toMatchObject({ name: "TogetherSseTurnTimeoutError" });
    expect(retry).not.toHaveBeenCalled();
  });

  test("persists and surfaces request IDs when an SSE stream stays idle", async () => {
    temporaryHome = await mkdtemp(path.join(os.tmpdir(), "togetherlink-sse-test-"));
    vi.stubEnv("TOGETHERLINK_HOME", temporaryHome);
    vi.stubEnv("TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "0");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const response = hangingSseResponse();
        response.headers.set("x-request-id", "upstream-request-123");
        return response;
      }),
    );
    const response = await postChatCompletionStream(
      { model: "fault-injection", messages: [], stream: true },
      { apiKey: "redacted" },
    );
    const consume = async () => {
      for await (const _event of readTogetherSseWithRetry(response, async () => sseResponse([]), {
        isOutputStarted: () => false,
      })) {
        // The fault-injection stream never emits.
      }
    };

    const error = await consume().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      name: "TogetherSseIdleTimeoutError",
      upstreamRequestId: "upstream-request-123",
    });
    expect((error as Error).message).toContain("upstream request ID: upstream-request-123");

    const diagnostics = await readFile(resolveRequestDiagnosticsPath(temporaryHome), "utf8");
    const persisted = JSON.parse(diagnostics.trim()) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      phase: "sse",
      reason: "idle_timeout",
      upstreamRequestId: "upstream-request-123",
      timeoutMs: 100,
    });
    expect(persisted.clientRequestId).toEqual(expect.any(String));
  });
});

function sseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

function hangingSseResponse(onCancel?: () => void): Response {
  return new Response(
    new ReadableStream({
      cancel() {
        onCancel?.();
        // The shared transport must cancel this reader before retrying.
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

function activeSseResponse(): Response {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let emitted = 0;
  return new Response(
    new ReadableStream({
      start(controller) {
        interval = setInterval(() => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "." } }] })}\n\n`,
            ),
          );
          emitted += 1;
          if (emitted === 8) {
            clearInterval(interval);
            interval = undefined;
            controller.close();
          }
        }, 25);
      },
      cancel() {
        if (interval) {
          clearInterval(interval);
          interval = undefined;
        }
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

function prematurelyClosedSseResponse(events: unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function terminatedSseResponse(): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { reasoning: "still thinking" } }] })}\n\n`,
          ),
        );
        controller.error(new TypeError("terminated"));
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}
