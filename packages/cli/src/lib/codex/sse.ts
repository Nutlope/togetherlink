import { type ServerResponse } from "node:http";
import { writeSse } from "../sse.js";

/**
 * Responses-API SSE emission — the Codex-specific `sequence_number` injection
 * that used to live in the "shared" `sse.ts`, leaking a harness-specific wire
 * concept into the shared module. Pulled out so `sse.ts` stays harness-agnostic
 * and a reader of the shared streaming module no longer needs to know about
 * the Codex Responses API to understand half the file.
 */

const responseSequenceNumbers = new WeakMap<ServerResponse, number>();

export function writeResponsesSse(res: ServerResponse, event: string, data: unknown): void {
  const sequenceNumber = responseSequenceNumbers.get(res) ?? 0;
  responseSequenceNumbers.set(res, sequenceNumber + 1);
  const payload =
    data && typeof data === "object" && !Array.isArray(data) && !("sequence_number" in data)
      ? { ...(data as Record<string, unknown>), sequence_number: sequenceNumber }
      : data;
  writeSse(res, event, payload);
}
