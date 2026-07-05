import { type ServerResponse } from "node:http";

type SseChunkReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>>;

export function consumeSseLines(buffer: string, onData: (data: string) => void): string {
  let consumed = 0;
  for (;;) {
    const boundary = findSseBoundary(buffer, consumed);
    if (!boundary) {
      break;
    }
    const data = sseDataPayload(buffer.slice(consumed, boundary.index));
    if (data !== undefined) {
      onData(data);
    }
    consumed = boundary.index + boundary.length;
  }
  return buffer.slice(consumed);
}

export function* takeSseEvents(buffer: string): Generator<{ payload: string; remaining: string }> {
  let current = buffer;
  let boundary = findSseBoundary(current);
  while (boundary) {
    const rawEvent = current.slice(0, boundary.index);
    current = current.slice(boundary.index + boundary.length);
    yield { payload: sseEventPayload(rawEvent), remaining: current };
    boundary = findSseBoundary(current);
  }
}

export function findSseBoundary(
  buffer: string,
  fromIndex = 0,
): { index: number; length: number } | undefined {
  let newline = buffer.indexOf("\n", fromIndex);
  while (newline !== -1) {
    const next = newline + 1;
    const nextCode = buffer.charCodeAt(next);
    if (nextCode === 10) {
      return { index: newline, length: 2 };
    }
    if (nextCode === 13 && buffer.charCodeAt(next + 1) === 10) {
      return { index: newline, length: 3 };
    }
    if (newline > fromIndex && buffer.charCodeAt(newline - 1) === 13) {
      if (nextCode === 10) {
        return { index: newline - 1, length: 3 };
      }
      if (nextCode === 13 && buffer.charCodeAt(next + 1) === 10) {
        return { index: newline - 1, length: 4 };
      }
    }
    newline = buffer.indexOf("\n", next);
  }
  return undefined;
}

export function sseDataPayload(rawEvent: string): string | undefined {
  let payload = "";
  let hasData = false;
  let lineStart = 0;
  for (;;) {
    let lineEnd = rawEvent.indexOf("\n", lineStart);
    if (lineEnd === -1) {
      lineEnd = rawEvent.length;
    }
    const line =
      lineEnd > lineStart && rawEvent.charCodeAt(lineEnd - 1) === 13
        ? rawEvent.slice(lineStart, lineEnd - 1)
        : rawEvent.slice(lineStart, lineEnd);
    if (line.startsWith("data:")) {
      const valueStart = line.charCodeAt(5) === 32 ? 6 : 5;
      if (hasData) {
        payload += "\n";
      }
      payload += line.slice(valueStart);
      hasData = true;
    }
    if (lineEnd === rawEvent.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }
  return hasData ? payload : undefined;
}

export function sseEventPayload(rawEvent: string): string {
  return sseDataPayload(rawEvent) ?? "";
}

export type SseIdleWatchdog = {
  read: (reader: ReadableStreamDefaultReader<Uint8Array>) => Promise<SseChunkReadResult>;
  dispose: () => void;
};

/**
 * Owns ONE idle-watchdog timer for the lifetime of a stream, reset on every
 * chunk read via timer.refresh(). This replaces the old per-read
 * Promise.race + setTimeout pattern (hundreds of timer allocations per turn)
 * with a single timer that is reused across reads via refresh().
 *
 * `read()` resolves with the upstream chunk, or rejects with createTimeoutError()
 * when no chunk arrives within idleTimeoutMs. `dispose()` clears the timer so
 * the process does not hold the event loop open after the stream ends.
 *
 * Semantics are identical to the old per-call readSseChunk: the idle window is
 * measured from the moment read() is entered to the moment reader.read()
 * resolves; each new read() re-arms the same timer instead of allocating a
 * fresh setTimeout handle.
 */
export function createSseIdleWatchdog(
  idleTimeoutMs: number,
  createTimeoutError: () => Error = () =>
    new Error(`SSE stream produced no event for ${idleTimeoutMs}ms.`),
): SseIdleWatchdog {
  // ONE timer for the whole stream, reused across reads via timer.refresh()
  // instead of allocating a fresh setTimeout handle per chunk. The timer is
  // only cleared when the stream ends (dispose) or when it fires the idle
  // error; a successful read leaves it pending so the next arm() can refresh()
  // the same handle. A between-reads tick is a no-op because rejectIdle is
  // reset to undefined on every successful resolve.
  let timer: NodeJS.Timeout | undefined;
  let rejectIdle: ((err: Error) => void) | undefined;
  let disposed = false;

  const arm = () => {
    if (disposed) {
      return;
    }
    if (timer) {
      // Reuse the existing pending timer: reset its deadline to
      // idleTimeoutMs from now without allocating a new handle.
      timer.refresh();
      return;
    }
    timer = setTimeout(() => {
      const reject = rejectIdle;
      rejectIdle = undefined;
      // Once the idle error fires, the timer is spent; drop the handle so a
      // later dispose()/arm() doesn't refresh a dead timer.
      timer = undefined;
      reject?.(createTimeoutError());
    }, idleTimeoutMs);
  };

  return {
    async read(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<SseChunkReadResult> {
      // Fresh idle promise per read; its reject is captured into rejectIdle so
      // the single shared timer can fire it. The timer handle itself is reused
      // across reads via refresh(), not reallocated.
      const idle = new Promise<SseChunkReadResult>((_, reject) => {
        rejectIdle = reject;
      });
      arm();
      try {
        return await Promise.race([reader.read(), idle]);
      } finally {
        // Drop this read's rejector so a late timer tick (e.g. one that fires
        // between reads while the caller is processing the chunk) cannot reject
        // a future read's promise. The timer is intentionally left pending so
        // the next read can refresh() it; dispose() clears it at stream end.
        rejectIdle = undefined;
      }
    },
    dispose(): void {
      disposed = true;
      rejectIdle = undefined;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

/**
 * Reads one upstream chunk with an idle timeout. Allocates a fresh
 * createSseIdleWatchdog per call (one-shot semantics) for backward
 * compatibility with call sites that read a single chunk. Streams that read
 * hundreds of chunks per turn should instead hold one createSseIdleWatchdog
 * and call watchdog.read() in a loop, disposing it when the stream ends.
 */
export async function readSseChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
  createTimeoutError: () => Error = () =>
    new Error(`SSE stream produced no event for ${idleTimeoutMs}ms.`),
): Promise<SseChunkReadResult> {
  const watchdog = createSseIdleWatchdog(idleTimeoutMs, createTimeoutError);
  try {
    return await watchdog.read(reader);
  } finally {
    watchdog.dispose();
  }
}

/**
 * Emits one SSE event to the response in a single res.write call. Concatenating
 * the `event:` and `data:` frames halves syscalls/packets versus the old
 * two-write form; with socket.setNoDelay(true) each write can flush as its own
 * packet, so one write per event keeps a long streamed response to one packet
 * per delta. Framing is byte-identical: `event: <event>\ndata: <json>\n\n`.
 */
export function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
