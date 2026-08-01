import * as zlib from "node:zlib";
import { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { ResponsesRequest } from "./wire-types.js";

export const DEFAULT_CODEX_NATIVE_BASE_URL = "https://chatgpt.com/backend-api/codex";
export const DEFAULT_CODEX_MAX_ENCODED_REQUEST_BYTES = 64 * 1024 * 1024;
export const DEFAULT_CODEX_MAX_DECODED_REQUEST_BYTES = 64 * 1024 * 1024;

export type CodexRequestLimits = {
  maxEncodedBytes: number;
  maxDecodedBytes: number;
};

export class CodexRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CodexRequestError";
    this.status = status;
  }
}

const FORWARD_REQUEST_HEADERS = new Set([
  "authorization",
  "chatgpt-account-id",
  "openai-beta",
  "originator",
  "session_id",
  "session-id",
  "thread-id",
  "version",
  "x-client-request-id",
  "x-codex-beta-features",
  "x-codex-image-turn-id",
  "x-codex-installation-id",
  "x-codex-parent-thread-id",
  "x-codex-turn-metadata",
  "x-codex-turn-state",
  "x-codex-window-id",
  "x-oai-attestation",
  "x-openai-internal-codex-responses-lite",
  "x-openai-memgen-request",
  "x-openai-subagent",
  "x-responsesapi-include-timing-metrics",
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export type DecodedCodexRequest = {
  body: ResponsesRequest;
  bytes: Buffer;
  rawBytes: number;
};

/**
 * Read a Codex request once and decode the compression used by the built-in
 * OpenAI provider. Recent desktop builds can send zstd bodies; custom provider
 * traffic normally arrives as plain JSON.
 */
export async function readDecodedCodexRequest(
  req: IncomingMessage,
  limits: CodexRequestLimits = {
    maxEncodedBytes: DEFAULT_CODEX_MAX_ENCODED_REQUEST_BYTES,
    maxDecodedBytes: DEFAULT_CODEX_MAX_DECODED_REQUEST_BYTES,
  },
): Promise<DecodedCodexRequest> {
  const chunks: Buffer[] = [];
  let encodedBytes = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    encodedBytes += bytes.length;
    if (encodedBytes > limits.maxEncodedBytes) {
      throw new CodexRequestError(413, "Codex request body is too large.");
    }
    chunks.push(bytes);
  }
  const encoded = Buffer.concat(chunks);
  const bytes = decodeBody(encoded, req.headers["content-encoding"], limits.maxDecodedBytes);
  const text = bytes.toString("utf8");
  let body: ResponsesRequest;
  try {
    body = (text ? JSON.parse(text) : {}) as ResponsesRequest;
  } catch {
    throw new CodexRequestError(400, "Codex request body must contain valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CodexRequestError(400, "Codex request body must be a JSON object.");
  }
  return {
    body,
    bytes,
    // The token estimator needs the JSON payload size, not the compressed
    // transport size used by the built-in provider.
    rawBytes: bytes.length,
  };
}

/** Route a non-Together model back to Codex's normal ChatGPT backend. */
export async function forwardNativeCodexRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    baseUrl: string;
    path: string;
    body: Buffer;
    fetch?: (input: string, init: RequestInit) => Promise<Response>;
  },
): Promise<void> {
  const controller = new AbortController();
  const abort = () =>
    controller.abort(new DOMException("Codex client disconnected.", "AbortError"));
  req.once("aborted", abort);
  res.once("close", () => {
    if (!res.writableEnded) abort();
  });

  const fetchImpl =
    options.fetch ?? ((input: string, init: RequestInit) => globalThis.fetch(input, init));
  const search = new URL(req.url ?? options.path, "http://togetherlink.local").search;
  const target = `${options.baseUrl.replace(/\/+$/, "")}${nativePath(options.path)}${search}`;
  const upstream = await fetchImpl(target, {
    method: req.method ?? "POST",
    headers: nativeRequestHeaders(req.headers, options.body.length),
    body: options.body,
    signal: controller.signal,
  });

  const responseHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders[name] = value;
    }
  });
  res.writeHead(upstream.status, responseHeaders);
  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!res.write(Buffer.from(next.value))) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
  } catch {
    // Client disconnect (abort) or a broken upstream stream. Headers are
    // already sent on this connection at this point (writeHead above), so
    // there's no error response left to send — just stop. Letting this throw
    // used to reach the daemon's top-level catch-all, which tried to write a
    // second response on the same connection and crashed the whole process.
  } finally {
    reader.releaseLock();
    if (!res.writableEnded) {
      res.end();
    }
  }
}

/** Preserve native auth/account headers, but never arbitrary client headers. */
export function nativeRequestHeaders(
  incoming: IncomingHttpHeaders,
  contentLength: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Content-Length": String(contentLength),
    "Accept-Encoding": "identity",
  };
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = incoming[name];
    if (value !== undefined) {
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  return headers;
}

export function nativeCodexBaseUrl(rawConfig: string): string {
  const preamble = rawConfig.split(/^\s*\[/m, 1)[0] ?? rawConfig;
  const match = preamble.match(/^\s*chatgpt_base_url\s*=\s*(["'])(.*?)\1\s*$/m);
  const configured = match?.[2]?.replace(/\/+$/, "");
  if (!configured) return DEFAULT_CODEX_NATIVE_BASE_URL;
  return configured.endsWith("/codex") ? configured : `${configured}/codex`;
}

function nativePath(path: string): string {
  const withoutV1 = path.replace(/^\/v1(?=\/|$)/, "");
  return withoutV1 || "/";
}

function decodeBody(
  raw: Buffer,
  contentEncoding: string | string[] | undefined,
  maxDecodedBytes: number,
): Buffer {
  const encodings = (
    Array.isArray(contentEncoding) ? contentEncoding.join(",") : (contentEncoding ?? "")
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value && value !== "identity")
    .reverse();
  let decoded = raw;
  try {
    for (const encoding of encodings) {
      const options = { maxOutputLength: maxDecodedBytes };
      if (encoding === "gzip" || encoding === "x-gzip") {
        decoded = zlib.gunzipSync(decoded, options);
      } else if (encoding === "deflate") {
        decoded = zlib.inflateSync(decoded, options);
      } else if (encoding === "br") {
        decoded = zlib.brotliDecompressSync(decoded, options);
      } else if (encoding === "zstd") {
        decoded = zstdDecompress(decoded, maxDecodedBytes);
      } else {
        throw new CodexRequestError(
          415,
          `Unsupported Codex request Content-Encoding: ${encoding}.`,
        );
      }
      assertDecodedBodySize(decoded, maxDecodedBytes);
    }
  } catch (error) {
    if (error instanceof CodexRequestError) {
      throw error;
    }
    if (isZlibOutputLimitError(error)) {
      throw new CodexRequestError(413, "Decoded Codex request body is too large.");
    }
    throw new CodexRequestError(400, "Codex request body compression is invalid.");
  }
  assertDecodedBodySize(decoded, maxDecodedBytes);
  return decoded;
}

function zstdDecompress(value: Buffer, maxOutputLength: number): Buffer {
  const nodeZstd = (
    zlib as typeof zlib & {
      zstdDecompressSync?: (input: Uint8Array, options?: { maxOutputLength?: number }) => Buffer;
    }
  ).zstdDecompressSync;
  if (nodeZstd) return Buffer.from(nodeZstd(value, { maxOutputLength }));

  throw new CodexRequestError(
    415,
    "This runtime cannot safely decode the Codex zstd request within the configured size limit. Use the current TogetherLink installer or Node 22.15+.",
  );
}

function assertDecodedBodySize(value: Buffer, maxDecodedBytes: number): void {
  if (value.length > maxDecodedBytes) {
    throw new CodexRequestError(413, "Decoded Codex request body is too large.");
  }
}

function isZlibOutputLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code?: unknown }).code === "ERR_BUFFER_TOO_LARGE"
  );
}
