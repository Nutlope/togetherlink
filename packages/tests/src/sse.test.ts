import { describe, expect, test, vi } from "vitest";
import { type ServerResponse } from "node:http";
import { createSseIdleWatchdog, writeSse, writeResponsesSse } from "../../cli/src/lib/sse.js";

/**
 * Minimal ServerResponse stand-in that records every res.write() call's
 * argument verbatim. The SSE writers only ever call res.write(string); they do
 * not use buffers, encoding args, or end(). A plain object is a valid WeakMap
 * key (writeResponsesSse keys sequence numbers on it), so no real socket is
 * needed for these unit tests.
 */
function createMockResponse(): ServerResponse & { writes: string[] } {
  const writes: string[] = [];
  const res = {
    write(chunk: unknown): boolean {
      writes.push(typeof chunk === "string" ? chunk : String(chunk));
      return true;
    },
  } as unknown as ServerResponse & { writes: string[] };
  Object.defineProperty(res, "writes", { value: writes, enumerable: true });
  return res;
}

function allWrites(res: { writes: string[] }): string {
  return res.writes.join("");
}

describe("writeSse emits one write per event with correct framing", () => {
  test("a single event is exactly one res.write call with event: + data: + blank line", () => {
    const res = createMockResponse();
    writeSse(res, "message_start", { hello: "world" });

    expect(res.writes).toHaveLength(1);
    expect(res.writes[0]).toBe(
      `event: message_start\ndata: ${JSON.stringify({ hello: "world" })}\n\n`,
    );
  });

  test("many events each produce exactly one write (no batching across events)", () => {
    const res = createMockResponse();
    for (let i = 0; i < 50; i += 1) {
      writeSse(res, "content_block_delta", { index: i, delta: { text: `t${i}` } });
    }
    expect(res.writes).toHaveLength(50);
    const stream = allWrites(res);
    const events = stream.split("\n\n").filter((line) => line.length > 0);
    expect(events).toHaveLength(50);
    expect(events[0]).toBe(
      `event: content_block_delta\ndata: ${JSON.stringify({ index: 0, delta: { text: "t0" } })}`,
    );
    expect(events[49]).toBe(
      `event: content_block_delta\ndata: ${JSON.stringify({ index: 49, delta: { text: "t49" } })}`,
    );
  });

  test("data is JSON.stringify'd the same way regardless of write count", () => {
    const res = createMockResponse();
    const payload = { a: [1, 2, 3], b: "x\ny", nested: { ok: true } };
    writeSse(res, "e", payload);
    expect(res.writes).toHaveLength(1);
    expect(res.writes[0]).toBe(`event: e\ndata: ${JSON.stringify(payload)}\n\n`);
    expect(res.writes[0].includes(`"b":"x\\ny"`)).toBe(true);
  });
});

describe("writeResponsesSse injects sequence numbers", () => {
  test("starts at 0 and increments by one per event on the same response", () => {
    const res = createMockResponse();
    writeResponsesSse(res, "response.created", { type: "response.created" });
    writeResponsesSse(res, "response.in_progress", { type: "response.in_progress" });
    writeResponsesSse(res, "response.completed", { type: "response.completed" });

    expect(res.writes).toHaveLength(3);
    const created = JSON.parse(res.writes[0].split("data: ")[1].trim()) as Record<string, unknown>;
    const inProgress = JSON.parse(res.writes[1].split("data: ")[1].trim()) as Record<
      string,
      unknown
    >;
    const completed = JSON.parse(res.writes[2].split("data: ")[1].trim()) as Record<
      string,
      unknown
    >;
    expect(created.sequence_number).toBe(0);
    expect(inProgress.sequence_number).toBe(1);
    expect(completed.sequence_number).toBe(2);
  });

  test("each response object has its own independent sequence counter", () => {
    const resA = createMockResponse();
    const resB = createMockResponse();
    writeResponsesSse(resA, "e", { x: 1 });
    writeResponsesSse(resB, "e", { x: 1 });
    writeResponsesSse(resA, "e", { x: 2 });
    writeResponsesSse(resB, "e", { x: 2 });

    const aSeqs = resA.writes.map(
      (w) => (JSON.parse(w.split("data: ")[1].trim()) as Record<string, unknown>).sequence_number,
    );
    const bSeqs = resB.writes.map(
      (w) => (JSON.parse(w.split("data: ")[1].trim()) as Record<string, unknown>).sequence_number,
    );
    expect(aSeqs).toEqual([0, 1]);
    expect(bSeqs).toEqual([0, 1]);
  });

  test("does not overwrite an existing sequence_number field", () => {
    const res = createMockResponse();
    writeResponsesSse(res, "e", { sequence_number: 999, payload: 1 });
    const parsed = JSON.parse(res.writes[0].split("data: ")[1].trim()) as Record<string, unknown>;
    expect(parsed.sequence_number).toBe(999);
  });
});

describe("createSseIdleWatchdog", () => {
  test("fires after the idle timeout when no chunk arrives", async () => {
    vi.useFakeTimers();
    try {
      const watchdog = createSseIdleWatchdog(100, () => new Error("idle"));
      const reader = {
        read: () => new Promise(() => {}),
      } as ReadableStreamDefaultReader<Uint8Array>;
      const promise = watchdog.read(reader);
      vi.advanceTimersByTime(99);
      await expect(Promise.race([promise, Promise.resolve("pending")])).resolves.toBe("pending");
      vi.advanceTimersByTime(2);
      await expect(promise).rejects.toThrow("idle");
      watchdog.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  test("does NOT fire when reads keep arriving within the idle window", async () => {
    const watchdog = createSseIdleWatchdog(100, () => new Error("idle"));
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let i = 0;
        const interval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(`data: {"i":${i}}\n\n`));
          i += 1;
          if (i >= 6) {
            clearInterval(interval);
            controller.close();
          }
        }, 20);
      },
      cancel() {
        cancelled = true;
      },
    });
    const reader = stream.getReader();
    let count = 0;
    const startedAt = Date.now();
    try {
      while (true) {
        const read = await watchdog.read(reader);
        if (read.done) {
          break;
        }
        count += 1;
      }
    } catch (err) {
      throw new Error(`watchdog fired unexpectedly after ${Date.now() - startedAt}ms: ${err}`);
    } finally {
      watchdog.dispose();
      reader.releaseLock();
    }
    expect(count).toBeGreaterThanOrEqual(5);
    expect(cancelled).toBe(false);
  });

  test("idle resets per read: a slow first read then fast reads do not trip a stale timer", async () => {
    const watchdog = createSseIdleWatchdog(100, () => new Error("idle"));
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        await new Promise((r) => setTimeout(r, 50));
        controller.enqueue(new TextEncoder().encode('data: {"a":1}\n\n'));
        await new Promise((r) => setTimeout(r, 5));
        controller.enqueue(new TextEncoder().encode('data: {"b":2}\n\n'));
        controller.close();
      },
    });
    const reader = stream.getReader();
    const payloads: string[] = [];
    try {
      while (true) {
        const read = await watchdog.read(reader);
        if (read.done) break;
        payloads.push(new TextDecoder().decode(read.value));
      }
    } finally {
      watchdog.dispose();
      reader.releaseLock();
    }
    expect(payloads.join("")).toContain('{"a":1}');
    expect(payloads.join("")).toContain('{"b":2}');
  });

  test("dispose clears the timer so the process does not hold the event loop open", async () => {
    vi.useFakeTimers();
    try {
      let fired = false;
      const watchdog = createSseIdleWatchdog(50, () => {
        fired = true;
        return new Error("idle");
      });
      const reader = {
        read: () => new Promise(() => {}),
      } as ReadableStreamDefaultReader<Uint8Array>;
      const promise = watchdog.read(reader);
      watchdog.dispose();
      vi.advanceTimersByTime(500);
      expect(fired).toBe(false);
      promise.catch(() => undefined);
    } finally {
      vi.useRealTimers();
    }
  });

  test("readSseChunk one-shot wrapper still works and disposes its watchdog", async () => {
    const { readSseChunk } = await import("../../cli/src/lib/sse.js");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"x":1}\n\n'));
        controller.close();
      },
    });
    const reader = stream.getReader();
    try {
      const read = await readSseChunk(reader, 1000);
      expect(read.done).toBe(false);
      expect(new TextDecoder().decode(read.value)).toContain('{"x":1}');
    } finally {
      reader.releaseLock();
    }
  });
});
