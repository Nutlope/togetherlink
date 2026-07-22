import { backoffMs, sleep } from "./together-retry.js";
import { getTogetherResponseDiagnostics } from "./together-client.js";
import { persistRequestDiagnostic } from "./request-diagnostics.js";
import { createSseIdleWatchdog, sseEventPayload, takeSseEvents } from "./sse.js";

const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 120_000;
const DEFAULT_STREAM_RETRIES = 1;

export type TogetherSseEvent = {
  data: string;
  /** Zero for the initial response, incremented after each safe idle retry. */
  attempt: number;
};

export type TogetherSseRetryInfo = {
  attempt: number;
  maxRetries: number;
  timeoutMs: number;
};

export class TogetherSseIdleTimeoutError extends Error {
  constructor(
    readonly timeoutMs: number,
    readonly clientRequestId?: string | undefined,
    readonly upstreamRequestId?: string | undefined,
  ) {
    const ids = [
      clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
      upstreamRequestId ? `upstream request ID: ${upstreamRequestId}` : undefined,
    ].filter(Boolean);
    super(
      `Together stream produced no SSE event for ${timeoutMs}ms.` +
        (ids.length > 0 ? ` (${ids.join(", ")})` : ""),
    );
    this.name = "TogetherSseIdleTimeoutError";
  }
}

export class TogetherSsePrematureCloseError extends Error {
  constructor(
    readonly clientRequestId?: string | undefined,
    readonly upstreamRequestId?: string | undefined,
  ) {
    const ids = [
      clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
      upstreamRequestId ? `upstream request ID: ${upstreamRequestId}` : undefined,
    ].filter(Boolean);
    super(
      "Together stream closed before the [DONE] event." +
        (ids.length > 0 ? ` (${ids.join(", ")})` : ""),
    );
    this.name = "TogetherSsePrematureCloseError";
  }
}

export class TogetherSseRetryResponseError extends Error {
  constructor(readonly response: Response) {
    super(`Together SSE retry returned HTTP ${response.status}.`);
    this.name = "TogetherSseRetryResponseError";
  }
}

/**
 * Read Together SSE data with one shared watchdog/retry policy. Harnesses keep
 * only their wire translation and report when semantic output has begun; this
 * module owns framing, cancellation, idle detection, backoff, and safe retry.
 */
export async function* readTogetherSseWithRetry(
  initialResponse: Response,
  retry: () => Promise<Response>,
  options: {
    isOutputStarted: () => boolean;
    onRetry?: ((info: TogetherSseRetryInfo) => void) | undefined;
  },
): AsyncGenerator<TogetherSseEvent> {
  const idleTimeoutMs = streamIdleTimeoutMs();
  const maxRetries = streamRetries();
  let response = initialResponse;
  let attempt = 0;

  for (;;) {
    try {
      for await (const data of readResponseSse(response, idleTimeoutMs)) {
        yield { data, attempt };
      }
      return;
    } catch (err) {
      if (
        !(err instanceof TogetherSseIdleTimeoutError) &&
        !(err instanceof TogetherSsePrematureCloseError)
      ) {
        throw err;
      }
      await persistStreamDiagnostic(response, err, attempt);
      if (options.isOutputStarted() || attempt >= maxRetries) {
        throw err;
      }
      options.onRetry?.({ attempt, maxRetries, timeoutMs: idleTimeoutMs });
      await sleep(backoffMs(attempt));
      const next = await retry();
      if (!next.ok) {
        throw new TogetherSseRetryResponseError(next);
      }
      if (!next.body) {
        throw new Error("Together returned no stream body after an SSE idle retry.");
      }
      response = next;
      attempt += 1;
    }
  }
}

async function* readResponseSse(response: Response, idleTimeoutMs: number): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("Together returned no stream body.");
  }
  const diagnostics = getTogetherResponseDiagnostics(response);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const watchdog = createSseIdleWatchdog(
    idleTimeoutMs,
    () =>
      new TogetherSseIdleTimeoutError(
        idleTimeoutMs,
        diagnostics?.clientRequestId,
        diagnostics?.upstreamRequestId,
      ),
  );
  let buffer = "";
  let sawDone = false;
  try {
    for (;;) {
      const read = await watchdog.read(reader);
      if (read.done) {
        break;
      }
      buffer += decoder.decode(read.value, { stream: true });
      for (const event of takeSseEvents(buffer)) {
        buffer = event.remaining;
        if (event.payload) {
          if (event.payload === "[DONE]") {
            sawDone = true;
          }
          yield event.payload;
        }
      }
    }
  } catch (err) {
    if (err instanceof TogetherSseIdleTimeoutError) {
      await reader.cancel(err).catch(() => undefined);
    }
    throw err;
  } finally {
    watchdog.dispose();
    reader.releaseLock();
  }

  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing) {
    const payload = sseEventPayload(trailing);
    if (payload) {
      if (payload === "[DONE]") {
        sawDone = true;
      }
      yield payload;
    }
  }
  if (!sawDone) {
    throw new TogetherSsePrematureCloseError(
      diagnostics?.clientRequestId,
      diagnostics?.upstreamRequestId,
    );
  }
}

async function persistStreamDiagnostic(
  response: Response,
  error: TogetherSseIdleTimeoutError | TogetherSsePrematureCloseError,
  attempt: number,
): Promise<void> {
  const diagnostics = getTogetherResponseDiagnostics(response);
  if (!diagnostics) {
    return;
  }
  await persistRequestDiagnostic({
    phase: "sse",
    reason: error instanceof TogetherSseIdleTimeoutError ? "idle_timeout" : "premature_close",
    clientRequestId: diagnostics.clientRequestId,
    upstreamRequestId: diagnostics.upstreamRequestId,
    attempt,
    ...(error instanceof TogetherSseIdleTimeoutError ? { timeoutMs: error.timeoutMs } : {}),
    error: error.message,
  }).catch(() => undefined);
}

function streamIdleTimeoutMs(): number {
  const raw =
    process.env.TOGETHERLINK_STREAM_IDLE_TIMEOUT_MS ??
    process.env.TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(100, parsed)
    : DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

function streamRetries(): number {
  const raw =
    process.env.TOGETHERLINK_STREAM_RETRIES ?? process.env.TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_STREAM_RETRIES;
}
