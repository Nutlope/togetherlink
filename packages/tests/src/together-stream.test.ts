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

function hangingSseResponse(): Response {
  return new Response(
    new ReadableStream({
      cancel() {
        // The shared transport must cancel this reader before retrying.
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}
