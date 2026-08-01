import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSocket, RawData } from "ws";
import { consumeSseLines } from "../sse.js";
import { handleCodexProxyRequest, type CodexProxyOptions } from "./proxy.js";

/**
 * Codex/ChatGPT Desktop's Responses-over-WebSocket transport has no Together
 * equivalent upstream (Together only speaks HTTP+SSE), so this isn't a WS<->WS
 * relay. It terminates the client's WebSocket itself and drives the existing
 * HTTP/SSE Codex proxy internally, translating each SSE frame it writes into
 * one WS text frame — the same shape CLIProxyAPI's own SSE-to-WS adapter uses
 * for providers that lack a native upstream WebSocket.
 *
 * Only the self-contained `response.create` turn is supported. Together has no
 * server-side response storage, so Codex already sends the full conversation
 * `input` on every turn over HTTP; a WS `response.append` would imply
 * server-side continuation we don't have, so it's rejected with a close code
 * that tells the client to fall back to HTTP for that turn.
 */

const RESPONSES_WEBSOCKET_REPLAY_REQUIRED_CODE = 1012;
const RESPONSES_WEBSOCKET_REPLAY_REQUIRED_REASON = "upstream requires HTTP replay";

export function handleCodexResponsesWebsocket(ws: WebSocket, options: CodexProxyOptions): void {
  let activeSink: WebSocketSseSink | undefined;
  let queue: Promise<void> = Promise.resolve();

  ws.on("message", (raw: RawData) => {
    queue = queue.then(() => processTurn(raw)).catch((err) => sendFatalError(ws, err));
  });

  ws.on("close", () => {
    activeSink?.emit("close");
  });

  async function processTurn(raw: RawData): Promise<void> {
    const payload = parseMessage(raw);
    if (payload === undefined) {
      throw new Error("Codex websocket message must be a valid JSON object.");
    }
    const { type, ...body } = payload;
    if (type !== undefined && type !== "response.create") {
      ws.close(
        RESPONSES_WEBSOCKET_REPLAY_REQUIRED_CODE,
        RESPONSES_WEBSOCKET_REPLAY_REQUIRED_REASON,
      );
      return;
    }
    // The WS transport is inherently event-streamed; force it regardless of
    // what the client set, so every reachable code path inside the proxy
    // writes SSE-framed events instead of a single JSON body.
    body.stream = true;

    const req = fakeCodexRequest(body);
    const sink = new WebSocketSseSink(ws);
    activeSink = sink;
    try {
      await handleCodexProxyRequest(req, sink as unknown as ServerResponse, options);
    } finally {
      activeSink = undefined;
    }
  }
}

function parseMessage(raw: RawData): (Record<string, unknown> & { type?: unknown }) | undefined {
  const bytes = Buffer.isBuffer(raw)
    ? raw
    : Array.isArray(raw)
      ? Buffer.concat(raw)
      : Buffer.from(raw);
  const asText = bytes.toString("utf8");
  try {
    const parsed: unknown = JSON.parse(asText);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function fakeCodexRequest(body: Record<string, unknown>): IncomingMessage {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  const req = Readable.from([bytes]) as unknown as IncomingMessage;
  req.method = "POST";
  req.url = "/v1/responses";
  req.headers = { "content-type": "application/json" };
  return req;
}

function sendFatalError(ws: WebSocket, err: unknown): void {
  if (ws.readyState !== ws.OPEN) {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  ws.send(JSON.stringify({ type: "error", error: { type: "server_error", message } }));
}

/**
 * Duck-types just the `ServerResponse` surface `handleCodexProxyRequest` and
 * its streaming helpers (`stream.ts`/`sse.ts`) actually touch: writeHead,
 * flushHeaders, socket (optionally chained, so undefined is fine), write,
 * end, statusCode, writableEnded, and the `once("close", ...)` abort hookup.
 * Every reachable code path in the Codex proxy writes SSE-framed bytes
 * (`event: ...\ndata: ...\n\n`), including the native-model passthrough path,
 * which pipes raw upstream SSE bytes through `res.write`. `write()` here
 * never reports backpressure (always returns true), so the native-forward
 * path's `res.once("drain", ...)` wait is never entered.
 */
class WebSocketSseSink extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  readonly socket = undefined;
  private buffer = "";
  private readonly ws: WebSocket;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
  }

  writeHead(status: number): this {
    this.statusCode = status;
    return this;
  }

  flushHeaders(): void {}

  write(chunk: string | Buffer): boolean {
    this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.buffer = consumeSseLines(this.buffer, (data) => {
      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.send(data);
      }
    });
    return true;
  }

  end(chunk?: string | Buffer): void {
    if (chunk !== undefined) {
      this.write(chunk);
    }
    this.writableEnded = true;
  }
}
