import { type ServerResponse } from "node:http";

type SseChunkReadResult = Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>>;

const responseSequenceNumbers = new WeakMap<ServerResponse, number>();

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

export async function readSseChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
  createTimeoutError: () => Error = () =>
    new Error(`SSE stream produced no event for ${idleTimeoutMs}ms.`),
): Promise<SseChunkReadResult> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<SseChunkReadResult>((_, reject) => {
        timeout = setTimeout(() => reject(createTimeoutError()), idleTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function writeSse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function writeResponsesSse(res: ServerResponse, event: string, data: unknown): void {
  const sequenceNumber = responseSequenceNumbers.get(res) ?? 0;
  responseSequenceNumbers.set(res, sequenceNumber + 1);
  const payload =
    data && typeof data === "object" && !Array.isArray(data) && !("sequence_number" in data)
      ? { ...(data as Record<string, unknown>), sequence_number: sequenceNumber }
      : data;
  writeSse(res, event, payload);
}
