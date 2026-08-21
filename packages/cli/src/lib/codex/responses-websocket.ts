import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebSocket, RawData } from "ws";
import { consumeSseLines } from "../sse.js";
import { CODEX_ROUTABLE_MODELS } from "./defaults.js";
import { handleCodexProxyRequest, type CodexProxyOptions } from "./proxy.js";
import { relayNativeCodexWebsocket } from "./native-websocket-relay.js";
import { sanitizeNativeResponsesReplay } from "./native-replay.js";

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

export function handleCodexResponsesWebsocket(
  ws: WebSocket,
  options: CodexProxyOptions,
  upgradeHeaders: Record<string, string | string[] | undefined> = {},
  requestHandler: (
    req: IncomingMessage,
    res: ServerResponse,
    options: CodexProxyOptions,
  ) => Promise<void> = handleCodexProxyRequest,
): void {
  let activeSink: WebSocketSseSink | undefined;
  let queue: Promise<void> = Promise.resolve();
  let lastRequest: Record<string, unknown> | undefined;
  let lastResponseId: string | undefined;
  let lastResponseOutput: unknown[] = [];
  // Lazily created on the first turn whose model is not a curated Together
  // model: a true WS<->WS relay to the native ChatGPT backend (the same
  // approach CLIProxyAPI's CodexWebsocketsExecutor uses), kept open across
  // turns so native incremental `previous_response_id` turns keep working.
  let nativeRelay: { send(body: Record<string, unknown>): void; close(): void } | undefined;

  ws.on("message", (raw: RawData) => {
    queue = queue.then(() => processTurn(raw)).catch((err) => sendFatalError(ws, err));
  });

  ws.on("close", () => {
    activeSink?.emit("close");
    nativeRelay?.close();
  });

  async function processTurn(raw: RawData): Promise<void> {
    const payload = parseMessage(raw);
    if (payload === undefined) {
      throw new Error("Codex websocket message must be a valid JSON object.");
    }
    const { type, ...rawBody } = payload;
    if (type !== undefined && type !== "response.create") {
      ws.close(
        RESPONSES_WEBSOCKET_REPLAY_REQUIRED_CODE,
        RESPONSES_WEBSOCKET_REPLAY_REQUIRED_REASON,
      );
      return;
    }
    const continuesTogetherResponse =
      lastRequest !== undefined &&
      typeof rawBody.previous_response_id === "string" &&
      rawBody.previous_response_id === lastResponseId;
    if (isNativeRelayTurn(rawBody, options) && !continuesTogetherResponse) {
      const relay = ensureNativeRelay();
      const nativeBody = sanitizeNativeResponsesReplay(rawBody);
      lastRequest = undefined;
      lastResponseId = undefined;
      lastResponseOutput = [];
      relay.send({ ...nativeBody, type: "response.create" });
      return;
    }
    const body = expandIncrementalRequest(rawBody, lastRequest, lastResponseId, lastResponseOutput);
    if (body === undefined) {
      sendPreviousResponseNotFound(ws);
      return;
    }
    if (body.generate === false) {
      delete body.generate;
      delete body.previous_response_id;
      lastRequest = cloneJsonObject(body);
      lastResponseId = sendPrewarmCompleted(ws, body, options.modelId);
      lastResponseOutput = [];
      return;
    }
    delete body.generate;
    delete body.previous_response_id;

    // Native OpenAI models have no Together upstream; relay the turn over a
    // real upstream WebSocket instead of the HTTP/SSE proxy so the client
    // keeps its native transport, auth headers, and incremental turns.
    if (isNativeRelayTurn(body, options)) {
      const relay = ensureNativeRelay();
      const nativeBody = sanitizeNativeResponsesReplay(body);
      lastRequest = undefined;
      lastResponseId = undefined;
      lastResponseOutput = [];
      relay.send({ ...nativeBody, type: "response.create" });
      return;
    }

    // The WS transport is inherently event-streamed; force it regardless of
    // what the client set, so every reachable code path inside the proxy
    // writes SSE-framed events instead of a single JSON body.
    body.stream = true;

    const req = fakeCodexRequest(body);
    let completedResponse: Record<string, unknown> | undefined;
    const sink = new WebSocketSseSink(ws, (event) => {
      if (event.type === "response.completed" || event.type === "response.incomplete") {
        completedResponse = asRecord(event.response);
      }
    });
    activeSink = sink;
    try {
      await requestHandler(req, sink as unknown as ServerResponse, options);
    } finally {
      activeSink = undefined;
    }
    if (completedResponse !== undefined) {
      const responseId = completedResponse.id;
      lastRequest = cloneJsonObject(body);
      lastResponseId = typeof responseId === "string" ? responseId : undefined;
      lastResponseOutput = Array.isArray(completedResponse.output)
        ? cloneJsonArray(completedResponse.output)
        : [];
    }
  }

  function isNativeRelayTurn(body: Record<string, unknown>, opts: CodexProxyOptions): boolean {
    if (opts.nativeBaseUrl === undefined) {
      return false;
    }
    const model = body.model;
    return (
      typeof model === "string" &&
      model !== "" &&
      !CODEX_ROUTABLE_MODELS.some((candidate) => candidate.id === model)
    );
  }

  function ensureNativeRelay(): { send(body: Record<string, unknown>): void; close(): void } {
    if (nativeRelay === undefined) {
      nativeRelay = relayNativeCodexWebsocket(ws, options, upgradeHeaders);
    }
    return nativeRelay;
  }
}

function expandIncrementalRequest(
  body: Record<string, unknown>,
  lastRequest: Record<string, unknown> | undefined,
  lastResponseId: string | undefined,
  lastResponseOutput: unknown[],
): Record<string, unknown> | undefined {
  const previousResponseId = body.previous_response_id;
  if (typeof previousResponseId !== "string" || previousResponseId === "") {
    return cloneJsonObject(body);
  }
  if (lastRequest === undefined || previousResponseId !== lastResponseId) {
    return undefined;
  }
  const previousInput = Array.isArray(lastRequest.input) ? lastRequest.input : [];
  const incrementalInput = Array.isArray(body.input) ? body.input : [];
  return {
    ...cloneJsonObject(body),
    input: cloneJsonArray([...previousInput, ...lastResponseOutput, ...incrementalInput]),
  };
}

function sendPrewarmCompleted(
  ws: WebSocket,
  body: Record<string, unknown>,
  defaultModel: string,
): string {
  const responseId = `resp_${randomUUID().replaceAll("-", "")}`;
  const createdAt = Math.floor(Date.now() / 1_000);
  const model = typeof body.model === "string" ? body.model : defaultModel;
  const created = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    status: "in_progress",
    model,
    output: [],
  };
  ws.send(JSON.stringify({ type: "response.created", response: created }));
  ws.send(
    JSON.stringify({
      type: "response.completed",
      response: {
        ...created,
        status: "completed",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          output_tokens_details: { reasoning_tokens: 0 },
        },
      },
    }),
  );
  return responseId;
}

function sendPreviousResponseNotFound(ws: WebSocket): void {
  ws.send(
    JSON.stringify({
      type: "error",
      status: 409,
      error: {
        type: "invalid_request_error",
        code: "previous_response_not_found",
        param: "previous_response_id",
        message:
          "Previous response is not available on this websocket; resend the full conversation input.",
      },
    }),
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function cloneJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneJsonArray(value: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(value)) as unknown[];
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
  private readonly onEvent: ((event: Record<string, unknown>) => void) | undefined;

  constructor(ws: WebSocket, onEvent?: (event: Record<string, unknown>) => void) {
    super();
    this.ws = ws;
    this.onEvent = onEvent;
  }

  writeHead(status: number): this {
    this.statusCode = status;
    return this;
  }

  flushHeaders(): void {}

  write(chunk: string | Buffer): boolean {
    this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.buffer = consumeSseLines(this.buffer, (data) => {
      try {
        const event = asRecord(JSON.parse(data));
        if (event !== undefined) {
          this.onEvent?.(event);
        }
      } catch {
        // Forward non-JSON data unchanged; the client owns protocol validation.
      }
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
