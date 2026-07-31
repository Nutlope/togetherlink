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
  reason: "idle_timeout" | "turn_timeout" | "premature_close";
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

export class TogetherSseTurnTimeoutError extends TogetherSseIdleTimeoutError {
  constructor(
    timeoutMs: number,
    clientRequestId?: string | undefined,
    upstreamRequestId?: string | undefined,
  ) {
    super(timeoutMs, clientRequestId, upstreamRequestId);
    const ids = [
      clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
      upstreamRequestId ? `upstream request ID: ${upstreamRequestId}` : undefined,
    ].filter(Boolean);
    this.message =
      `Together stream exceeded maximum turn duration of ${timeoutMs}ms.` +
      (ids.length > 0 ? ` (${ids.join(", ")})` : "");
    this.name = "TogetherSseTurnTimeoutError";
  }
}

export class TogetherSsePrematureCloseError extends Error {
  constructor(
    readonly clientRequestId?: string | undefined,
    readonly upstreamRequestId?: string | undefined,
    cause?: unknown,
  ) {
    const ids = [
      clientRequestId ? `client request ID: ${clientRequestId}` : undefined,
      upstreamRequestId ? `upstream request ID: ${upstreamRequestId}` : undefined,
    ].filter(Boolean);
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    super(
      "Together stream closed before the [DONE] event." +
        (causeMessage ? ` Upstream reader error: ${causeMessage}.` : "") +
        (ids.length > 0 ? ` (${ids.join(", ")})` : ""),
      { cause },
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
    signal?: AbortSignal | undefined;
  },
): AsyncGenerator<TogetherSseEvent> {
  const idleTimeoutMs = streamIdleTimeoutMs();
  const turnTimeoutMs = streamTurnTimeoutMs();
  const maxRetries = streamRetries();
  let response = initialResponse;
  let attempt = 0;

  for (;;) {
    await cancelResponseIfAborted(response, options.signal);
    try {
      for await (const data of readResponseSse(
        response,
        idleTimeoutMs,
        turnTimeoutMs,
        options.signal,
      )) {
        yield { data, attempt };
      }
      return;
    } catch (err) {
      throwIfAborted(options.signal);
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
      options.onRetry?.({
        attempt,
        maxRetries,
        timeoutMs: err instanceof TogetherSseTurnTimeoutError ? err.timeoutMs : idleTimeoutMs,
        reason:
          err instanceof TogetherSseTurnTimeoutError
            ? "turn_timeout"
            : err instanceof TogetherSseIdleTimeoutError
              ? "idle_timeout"
              : "premature_close",
      });
      await sleepWithSignal(backoffMs(attempt), options.signal);
      const next = await retry();
      await cancelResponseIfAborted(next, options.signal);
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

async function* readResponseSse(
  response: Response,
  idleTimeoutMs: number,
  turnTimeoutMs: number | undefined,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (!response.body) {
    throw new Error("Together returned no stream body.");
  }
  const diagnostics = getTogetherResponseDiagnostics(response);
  const reader = response.body.getReader();
  const cancelForCallerAbort = () => {
    void reader.cancel(abortReason(signal)).catch(() => undefined);
  };
  signal?.addEventListener("abort", cancelForCallerAbort, { once: true });
  if (signal?.aborted) {
    cancelForCallerAbort();
  }
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
  let turnError: TogetherSseTurnTimeoutError | undefined;
  const turnTimer =
    turnTimeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          turnError = new TogetherSseTurnTimeoutError(
            turnTimeoutMs,
            diagnostics?.clientRequestId,
            diagnostics?.upstreamRequestId,
          );
          void reader.cancel(turnError).catch(() => undefined);
        }, turnTimeoutMs);
  turnTimer?.unref?.();
  let buffer = "";
  let sawDone = false;
  try {
    for (;;) {
      throwIfAborted(signal);
      if (turnError) {
        throw turnError;
      }
      const read = await watchdog.read(reader);
      throwIfAborted(signal);
      if (turnError) {
        throw turnError;
      }
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
    if (signal?.aborted) {
      await reader.cancel(abortReason(signal)).catch(() => undefined);
      throw abortReason(signal);
    }
    if (err instanceof TogetherSseIdleTimeoutError || err instanceof TogetherSseTurnTimeoutError) {
      await reader.cancel(err).catch(() => undefined);
      throw err;
    }
    const prematureClose = new TogetherSsePrematureCloseError(
      diagnostics?.clientRequestId,
      diagnostics?.upstreamRequestId,
      err,
    );
    throw prematureClose;
  } finally {
    if (turnTimer !== undefined) {
      clearTimeout(turnTimer);
    }
    watchdog.dispose();
    signal?.removeEventListener("abort", cancelForCallerAbort);
    reader.releaseLock();
  }

  throwIfAborted(signal);
  if (turnError) {
    throw turnError;
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

function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortReason(signal);
  }
}

async function cancelResponseIfAborted(
  response: Response,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (!signal?.aborted) {
    return;
  }
  await response.body?.cancel(abortReason(signal)).catch(() => undefined);
  throw abortReason(signal);
}

async function sleepWithSignal(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (!signal) {
    await sleep(ms);
    return;
  }
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    timer.unref?.();
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function persistStreamDiagnostic(
  response: Response,
  error: TogetherSseIdleTimeoutError | TogetherSseTurnTimeoutError | TogetherSsePrematureCloseError,
  attempt: number,
): Promise<void> {
  const diagnostics = getTogetherResponseDiagnostics(response);
  if (!diagnostics) {
    return;
  }
  await persistRequestDiagnostic({
    phase: "sse",
    reason:
      error instanceof TogetherSseTurnTimeoutError
        ? "turn_timeout"
        : error instanceof TogetherSseIdleTimeoutError
          ? "idle_timeout"
          : "premature_close",
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

export function streamTurnTimeoutMs(): number | undefined {
  const raw =
    process.env.TOGETHERLINK_STREAM_TURN_TIMEOUT_MS ??
    process.env.TOGETHERLINK_CODEX_STREAM_TURN_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(100, parsed) : undefined;
}

function streamRetries(): number {
  const raw =
    process.env.TOGETHERLINK_STREAM_RETRIES ?? process.env.TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_STREAM_RETRIES;
}
