import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { gzip } from "node:zlib";
import { CODEX_MEMORIES_PATH, normalizeCodexPath } from "./codex/routes.js";

const MAX_BODY_BYTES = 256 * 1024 * 1024;
const COMPRESSION_THRESHOLD_BYTES = 64 * 1024;

export type RemoteGatewayState = {
  requestedModel?: string | undefined;
  resolvedModel?: string | undefined;
};

export function shouldForwardCodexRequestToRemoteGateway(
  req: Pick<IncomingMessage, "method" | "url" | "headers">,
): boolean {
  if (req.method !== "POST") return true;
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (normalizeCodexPath(path) === CODEX_MEMORIES_PATH) return false;

  const marker = req.headers["x-openai-memgen-request"];
  return Array.isArray(marker) ? marker.every((value) => !value.trim()) : !marker?.trim();
}

export async function forwardRemoteGatewayRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    apiKey: string;
    frontierApiKey?: string;
    gatewayBaseUrl: string;
    routeSessionId: string;
    state: RemoteGatewayState;
    fetch?: typeof fetch;
  },
): Promise<void> {
  const body = await readBody(req);
  learnRequestedModel(body, req.headers["content-encoding"], options.state);
  const encoded = await encodeBody(body, req.headers["content-encoding"]);
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException("Gateway client disconnected.", "AbortError"));
    }
  };
  req.once("aborted", abort);
  res.once("close", () => {
    if (!res.writableEnded) abort();
  });

  try {
    const response = await (options.fetch ?? fetch)(
      gatewayRequestUrl(options.gatewayBaseUrl, req.url),
      {
        ...(req.method ? { method: req.method } : {}),
        headers: gatewayHeaders(req, options, encoded.contentEncoding),
        ...(encoded.body.length > 0 ? { body: new Uint8Array(encoded.body) } : {}),
        signal: controller.signal,
      },
    );
    copyResponseHeaders(response, res);
    const resolvedModel = response.headers.get("x-togetherlink-resolved-model")?.trim();
    if (resolvedModel) options.state.resolvedModel = resolvedModel;
    res.writeHead(response.status);
    if (!response.body) {
      res.end();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(response.body as never)
        .on("error", reject)
        .on("end", resolve)
        .pipe(res, { end: true });
    });
  } finally {
    req.off("aborted", abort);
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("Gateway request body exceeds 256 MiB.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function encodeBody(
  body: Buffer,
  incomingEncoding: string | string[] | undefined,
): Promise<{ body: Buffer; contentEncoding?: string }> {
  const encoding = firstHeader(incomingEncoding)?.trim().toLowerCase();
  if (encoding && encoding !== "identity") return { body, contentEncoding: encoding };
  if (body.length < COMPRESSION_THRESHOLD_BYTES) return { body };
  const compressed = await new Promise<Buffer>((resolve, reject) => {
    gzip(body, { level: 3 }, (error, result) => (error ? reject(error) : resolve(result)));
  });
  return compressed.length < body.length ? { body: compressed, contentEncoding: "gzip" } : { body };
}

function gatewayRequestUrl(baseUrl: string, requestUrl: string | undefined): string {
  const target = new URL(baseUrl);
  const request = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const basePath = target.pathname.replace(/\/+$/, "");
  const suffix =
    basePath.endsWith("/v1") && request.pathname.startsWith("/v1/")
      ? request.pathname.slice(3)
      : request.pathname;
  target.pathname = `${basePath}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  target.search = request.search;
  return target.toString();
}

function gatewayHeaders(
  req: IncomingMessage,
  options: {
    apiKey: string;
    frontierApiKey?: string;
    routeSessionId: string;
    state: RemoteGatewayState;
  },
  contentEncoding?: string,
): Headers {
  const headers = new Headers({ Authorization: `Bearer ${options.apiKey}` });
  if (options.frontierApiKey) {
    headers.set("x-togetherlink-frontier-api-key", options.frontierApiKey);
  }
  const allowed = new Set([
    "accept",
    "accept-encoding",
    "content-type",
    "user-agent",
    "x-client-request-id",
  ]);
  for (const [name, raw] of Object.entries(req.headers)) {
    if (!allowed.has(name) && !name.startsWith("x-stainless-")) continue;
    const value = Array.isArray(raw) ? raw.join(", ") : raw;
    if (value) headers.set(name, value);
  }
  if (contentEncoding) headers.set("content-encoding", contentEncoding);
  headers.set("x-togetherlink-session-id", options.routeSessionId);
  if (options.state.resolvedModel) {
    headers.set("x-togetherlink-pinned-model", options.state.resolvedModel);
  }
  return headers;
}

function learnRequestedModel(
  body: Buffer,
  contentEncoding: string | string[] | undefined,
  state: RemoteGatewayState,
): void {
  const encoding = firstHeader(contentEncoding)?.trim().toLowerCase();
  if (encoding && encoding !== "identity") return;
  try {
    const parsed = JSON.parse(body.toString("utf8")) as { model?: unknown };
    const model = typeof parsed.model === "string" ? parsed.model : undefined;
    if (model !== state.requestedModel) state.resolvedModel = undefined;
    state.requestedModel = model;
  } catch {
    // The hosted gateway renders malformed request errors in Codex's protocol.
  }
}

function copyResponseHeaders(response: Response, res: ServerResponse): void {
  if (typeof res.setHeader !== "function") return;
  for (const [name, value] of response.headers) {
    if (
      name === "cache-control" ||
      name === "content-type" ||
      name === "retry-after" ||
      name === "x-request-id" ||
      name.startsWith("x-togetherlink-")
    ) {
      res.setHeader(name, value);
    }
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
