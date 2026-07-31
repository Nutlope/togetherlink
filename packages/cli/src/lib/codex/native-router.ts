import * as zlib from "node:zlib";
import { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { ResponsesRequest } from "./wire-types.js";

export const DEFAULT_CODEX_NATIVE_BASE_URL = "https://chatgpt.com/backend-api/codex";

const FORWARD_REQUEST_HEADERS = new Set([
  "authorization",
  "chatgpt-account-id",
  "openai-beta",
  "originator",
  "session_id",
  "session-id",
  "thread-id",
  "x-client-request-id",
  "x-codex-beta-features",
  "x-codex-installation-id",
  "x-codex-parent-thread-id",
  "x-codex-turn-metadata",
  "x-codex-turn-state",
  "x-codex-window-id",
  "x-oai-attestation",
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
export async function readDecodedCodexRequest(req: IncomingMessage): Promise<DecodedCodexRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const encoded = Buffer.concat(chunks);
  const bytes = decodeBody(encoded, req.headers["content-encoding"]);
  const text = bytes.toString("utf8");
  return {
    body: (text ? JSON.parse(text) : {}) as ResponsesRequest,
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
  const target = `${options.baseUrl.replace(/\/+$/, "")}${nativePath(options.path)}`;
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
    res.end();
  } finally {
    reader.releaseLock();
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

function decodeBody(raw: Buffer, contentEncoding: string | string[] | undefined): Buffer {
  const encodings = (
    Array.isArray(contentEncoding) ? contentEncoding.join(",") : (contentEncoding ?? "")
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value && value !== "identity")
    .reverse();
  let decoded = raw;
  for (const encoding of encodings) {
    if (encoding === "gzip" || encoding === "x-gzip") {
      decoded = zlib.gunzipSync(decoded);
    } else if (encoding === "deflate") {
      decoded = zlib.inflateSync(decoded);
    } else if (encoding === "br") {
      decoded = zlib.brotliDecompressSync(decoded);
    } else if (encoding === "zstd") {
      decoded = zstdDecompress(decoded);
    } else {
      throw new Error(`Unsupported Codex request Content-Encoding: ${encoding}.`);
    }
  }
  return decoded;
}

function zstdDecompress(value: Buffer): Buffer {
  const nodeZstd = (
    zlib as typeof zlib & {
      zstdDecompressSync?: (input: Uint8Array) => Buffer;
    }
  ).zstdDecompressSync;
  if (nodeZstd) return Buffer.from(nodeZstd(value));

  const bunZstd = (
    globalThis as {
      Bun?: { zstdDecompressSync?: (input: Uint8Array) => Uint8Array };
    }
  ).Bun?.zstdDecompressSync;
  if (bunZstd) return Buffer.from(bunZstd(value));
  throw new Error(
    "This Codex Desktop request uses zstd compression, but the TogetherLink runtime cannot decode zstd. Use the TogetherLink installer (Bun) or Node 22.15+.",
  );
}
