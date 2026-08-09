import { createConnection } from "node:net";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon, deleteSession, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

describe("daemon Responses WebSocket routing", () => {
  let context: TestContext;
  let daemon: TestDaemon;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
  }, 30_000);

  afterAll(async () => {
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("declines a WebSocket upgrade for an unresolved session with HTTP 426 so Codex falls back to SSE", async () => {
    const response = await requestWebSocketUpgrade(daemon.url, "/session/test/v1/responses");

    expect(response).toMatch(/^HTTP\/1\.1 426 Upgrade Required\r\n/);
    expect(response).toContain("Connection: close\r\n");
    expect(response).toContain("Content-Length: 0\r\n");
  });

  test("declines a WebSocket upgrade for a registered session on a non-responses path", async () => {
    const token = await registerCodexAppSessionWithFakeKey(daemon);
    try {
      const response = await requestWebSocketUpgrade(daemon.url, `/session/${token}/v1/models`);
      expect(response).toMatch(/^HTTP\/1\.1 426 Upgrade Required\r\n/);
    } finally {
      await deleteSession(daemon, token);
    }
  });

  test("accepts a WebSocket upgrade at /v1/responses for a registered codex-app session", async () => {
    const token = await registerCodexAppSessionWithFakeKey(daemon);
    try {
      const response = await requestWebSocketUpgrade(daemon.url, `/session/${token}/v1/responses`);
      expect(response).toMatch(/^HTTP\/1\.1 101 Switching Protocols\r\n/i);
      expect(response.toLowerCase()).toContain("upgrade: websocket\r\n");
    } finally {
      await deleteSession(daemon, token);
    }
  });

  test("accepts the compatibility WebSocket upgrade alias at /responses", async () => {
    const token = await registerCodexAppSessionWithFakeKey(daemon);
    try {
      const response = await requestWebSocketUpgrade(daemon.url, `/session/${token}/responses`);
      expect(response).toMatch(/^HTTP\/1\.1 101 Switching Protocols\r\n/i);
    } finally {
      await deleteSession(daemon, token);
    }
  });

  test("reuses a prewarmed Codex socket without running duplicate upstream inference", async () => {
    const upstreamRequests: Array<Record<string, unknown>> = [];
    const upstream = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      upstreamRequests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        [
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Hello" } }] })}`,
          `data: ${JSON.stringify({
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
          })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const upstreamAddress = upstream.address() as AddressInfo;
    const token = await registerCodexAppSessionWithFakeKey(
      daemon,
      `http://127.0.0.1:${upstreamAddress.port}/v1`,
    );
    const ws = new WebSocket(`${daemon.url.replace(/^http/, "ws")}/session/${token}/v1/responses`, {
      headers: { "OpenAI-Beta": "responses_websockets=2026-02-06" },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      });
      const prewarmEvents = await sendWebSocketRequest(ws, {
        type: "response.create",
        model: "zai-org/GLM-5.2",
        input: [{ type: "message", role: "user", content: "Hi" }],
        tools: [],
        tool_choice: "auto",
        generate: false,
      });
      const prewarmId = responseId(prewarmEvents);
      const responseEvents = await sendWebSocketRequest(ws, {
        type: "response.create",
        model: "zai-org/GLM-5.2",
        previous_response_id: prewarmId,
        input: [],
        tools: [],
        tool_choice: "auto",
      });

      expect(responseEvents.at(-1)?.type).toBe("response.completed");
      expect(upstreamRequests).toHaveLength(1);
      expect(upstreamRequests[0]?.messages).toEqual(
        expect.arrayContaining([expect.objectContaining({ role: "user", content: "Hi" })]),
      );
      expect(upstreamRequests[0]).not.toHaveProperty("tools");
      expect(upstreamRequests[0]).not.toHaveProperty("tool_choice");

      const followupEvents = await sendWebSocketRequest(ws, {
        type: "response.create",
        model: "zai-org/GLM-5.2",
        previous_response_id: responseId(responseEvents),
        input: [{ type: "message", role: "user", content: "Again" }],
        tools: [],
        tool_choice: "auto",
      });

      expect(followupEvents.at(-1)?.type).toBe("response.completed");
      expect(upstreamRequests).toHaveLength(2);
      expect(upstreamRequests[1]?.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Hi" }),
          expect.objectContaining({ role: "assistant", content: "Hello" }),
          expect.objectContaining({ role: "user", content: "Again" }),
        ]),
      );
    } finally {
      ws.close();
      await deleteSession(daemon, token);
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });
});

/**
 * Registers a codex-app session directly (bypassing registerCodexAppSession's
 * live TOGETHER_API_KEY requirement) since this suite only asserts the
 * upgrade handshake itself succeeds — no `response.create` message is ever
 * sent, so the fake key is never exercised against a real upstream.
 */
async function registerCodexAppSessionWithFakeKey(
  daemon: TestDaemon,
  baseUrl?: string,
): Promise<string> {
  const token = `codex-app-ws-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const model = {
    id: "zai-org/GLM-5.2",
    name: "GLM 5.2",
    cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
    limit: { context: 262144, output: 164000 },
    attachment: false,
    reasoning: true,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
  };
  const response = await fetch(`${daemon.url}/internal/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      agent: "codex-app",
      apiKey: "test-together-key",
      ...(baseUrl ? { baseUrl } : {}),
      modelLabel: model.name,
      modelId: model.id,
      targetModelId: model.id,
      modelName: model.name,
      modelDefinition: model,
    }),
  });
  if (!response.ok) {
    throw new Error(`session registration failed: ${response.status} ${await response.text()}`);
  }
  return token;
}

async function sendWebSocketRequest(
  ws: WebSocket,
  request: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  return await new Promise((resolve, reject) => {
    const events: Array<Record<string, unknown>> = [];
    const onMessage = (raw: Buffer) => {
      const event = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      events.push(event);
      if (
        event.type === "response.completed" ||
        event.type === "response.incomplete" ||
        event.type === "response.failed"
      ) {
        cleanup();
        resolve(events);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      ws.off("message", onMessage);
      ws.off("error", onError);
    };
    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.send(JSON.stringify(request));
  });
}

function responseId(events: Array<Record<string, unknown>>): string {
  const completed = events.find((event) => event.type === "response.completed");
  const response = completed?.response as Record<string, unknown> | undefined;
  if (typeof response?.id !== "string") {
    throw new Error("WebSocket response completed without a response id");
  }
  return response.id;
}

async function requestWebSocketUpgrade(url: string, path: string): Promise<string> {
  const target = new URL(url);
  const chunks: Buffer[] = [];

  return await new Promise<string>((resolve, reject) => {
    const socket = createConnection({
      host: target.hostname,
      port: Number(target.port),
    });
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error && chunks.length === 0) {
        reject(error);
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const timeout = setTimeout(
      () => settle(new Error("daemon did not answer the WebSocket upgrade within 2 seconds")),
      2_000,
    );

    socket.once("connect", () => {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${target.host}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      // A successful 101 response has no Content-Length; the handshake line +
      // headers are enough to assert on, so stop as soon as we see the
      // blank-line header terminator instead of waiting for a timeout.
      if (Buffer.concat(chunks).includes("\r\n\r\n")) {
        settle();
      }
    });
    socket.once("end", () => settle());
    socket.once("close", () => settle());
    socket.once("error", (error) => settle(error));
  });
}
