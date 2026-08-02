import { WebSocket } from "ws";
import type { ClientOptions } from "ws";
import type { CodexProxyOptions } from "./proxy.js";

/**
 * True WS<->WS relay for native (non-Together) OpenAI models, mirroring
 * CLIProxyAPI's CodexWebsocketsExecutor: the desktop client's turn is
 * forwarded verbatim (as `response.create`) over a real upstream WebSocket to
 * the ChatGPT backend, and every upstream event frame is relayed back
 * untouched. This keeps the native transport's incremental
 * `previous_response_id` turns, server-side response storage, and event
 * framing intact — none of which survive the HTTP/SSE translation path.
 *
 * The upstream socket is dialed lazily on the first native turn and reused
 * for the lifetime of the downstream socket, so follow-up turns continue on
 * the same upstream connection exactly like the first-party client.
 */

/** Mirrors CLIProxyAPI's codexResponsesWebsocketBetaHeaderValue. */
const RESPONSES_WEBSOCKET_BETA = "responses_websockets=2026-02-06";
const UPSTREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** Headers copied from the client's HTTP upgrade onto the upstream dial.
 * Superset of CLIProxyAPI's applyCodexWebsocketHeaders carry-over list plus
 * the native-router's HTTP forward whitelist. */
const RELAY_UPGRADE_HEADERS = new Set([
  "authorization",
  "chatgpt-account-id",
  "conversation_id",
  "openai-beta",
  "originator",
  "session_id",
  "session-id",
  "user-agent",
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

export type NativeWebsocketRelay = {
  send(body: Record<string, unknown>): void;
  close(): void;
};

export function relayNativeCodexWebsocket(
  downstream: WebSocket,
  options: CodexProxyOptions,
  upgradeHeaders: Record<string, string | string[] | undefined>,
): NativeWebsocketRelay {
  const pending: string[] = [];
  let upstream: WebSocket | undefined;
  let closed = false;
  let idleTimer: NodeJS.Timeout | undefined;

  const url = nativeWebsocketUrl(options.nativeBaseUrl as string);
  const headers = buildUpstreamHeaders(upgradeHeaders);
  try {
    const clientOptions: ClientOptions = {
      headers,
      // Negotiate permessage-deflate like the first-party client
      // (CLIProxyAPI/codex-rs both enable it on the upstream dial).
      perMessageDeflate: true,
    };
    upstream = new WebSocket(url, clientOptions);
  } catch (err) {
    sendRelayError(downstream, err);
    return { send: () => {}, close: () => {} };
  }

  upstream.binaryType = "nodebuffer";
  upstream.on("open", () => {
    for (const frame of pending.splice(0)) {
      upstream?.send(frame);
    }
  });
  upstream.on("message", (data: Buffer | string, isBinary: boolean) => {
    bumpIdleTimer();
    if (downstream.readyState === downstream.OPEN) {
      downstream.send(data, { binary: isBinary });
    }
  });
  upstream.on("close", (code: number, reason: Buffer) => {
    closed = true;
    clearIdleTimer();
    if (downstream.readyState === downstream.OPEN) {
      downstream.close(code, reason);
    }
  });
  upstream.on("error", (err: Error) => {
    sendRelayError(downstream, err);
  });

  function bumpIdleTimer(): void {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      upstream?.close(1000, "idle timeout");
    }, UPSTREAM_IDLE_TIMEOUT_MS);
    idleTimer.unref?.();
  }
  function clearIdleTimer(): void {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  }
  bumpIdleTimer();

  return {
    send(body: Record<string, unknown>): void {
      if (closed) {
        return;
      }
      const frame = JSON.stringify(body);
      if (upstream !== undefined && upstream.readyState === upstream.OPEN) {
        upstream.send(frame);
      } else {
        pending.push(frame);
      }
      bumpIdleTimer();
    },
    close(): void {
      closed = true;
      clearIdleTimer();
      if (upstream !== undefined && upstream.readyState === upstream.OPEN) {
        upstream.close(1000);
      }
    },
  };
}

export function nativeWebsocketUrl(nativeBaseUrl: string): string {
  const httpUrl = `${nativeBaseUrl.replace(/\/+$/, "")}/responses`;
  if (httpUrl.startsWith("https://")) {
    return `wss://${httpUrl.slice("https://".length)}`;
  }
  if (httpUrl.startsWith("http://")) {
    return `ws://${httpUrl.slice("http://".length)}`;
  }
  return httpUrl;
}

function buildUpstreamHeaders(
  upgradeHeaders: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(upgradeHeaders)) {
    if (value === undefined || !RELAY_UPGRADE_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  // The upstream only accepts the websocket transport when the beta flag is
  // present; force it regardless of what the client sent (same as
  // CLIProxyAPI), since this socket exists solely to serve WS turns.
  const beta = headers["openai-beta"] ?? headers["OpenAI-Beta"];
  if (beta === undefined || !beta.includes("responses_websockets=")) {
    headers["OpenAI-Beta"] = RESPONSES_WEBSOCKET_BETA;
  }
  return headers;
}

function sendRelayError(downstream: WebSocket, err: unknown): void {
  if (downstream.readyState !== downstream.OPEN) {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  downstream.send(JSON.stringify({ type: "error", error: { type: "server_error", message } }));
}
