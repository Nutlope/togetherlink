import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexResponsesWebsocket } from "../../cli/src/lib/codex/responses-websocket.js";
import type { CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";

const options: CodexProxyOptions = {
  apiKey: "test-together-key",
  baseUrl: "https://api.together.ai/v1",
  modelId: GLM_5_2.id,
  targetModelId: GLM_5_2.id,
  modelName: GLM_5_2.name,
  modelDefinition: GLM_5_2,
  authToken: "test-token",
};

describe("Codex Responses WebSocket", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("streams a response.create turn back as WS text frames, same events the SSE path emits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          { choices: [{ index: 0, delta: { content: "Hi there" } }] },
          {
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
          },
        ]),
      ),
    );

    const { events, close } = await runWebsocketTurn({
      type: "response.create",
      model: GLM_5_2.id,
      input: [{ type: "message", role: "user", content: "hello" }],
    });
    try {
      expect(events.map((event) => event.type)).toEqual([
        "response.created",
        "response.in_progress",
        "response.output_item.added",
        "response.content_part.added",
        "response.output_text.delta",
        "response.output_text.done",
        "response.content_part.done",
        "response.output_item.done",
        "response.completed",
      ]);
      const completed = events[events.length - 1] as { response: { status: string } };
      expect(completed.response.status).toBe("completed");
    } finally {
      await close();
    }
  });

  test("rejects response.append with a replay-required close instead of guessing at continuation", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { ws, close } = await openWebsocket();
    try {
      const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
        ws.once("close", (code, reasonBuf) =>
          resolve({ code, reason: reasonBuf.toString("utf8") }),
        );
        ws.send(JSON.stringify({ type: "response.append", previous_response_id: "resp_unknown" }));
      });
      expect(closeEvent.code).toBe(1012);
      expect(closeEvent.reason).toBe("upstream requires HTTP replay");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      await close();
    }
  });
});

async function runWebsocketTurn(
  message: Record<string, unknown>,
): Promise<{ events: Array<Record<string, unknown>>; close: () => Promise<void> }> {
  const { ws, close } = await openWebsocket();
  const events: Array<Record<string, unknown>> = [];
  const done = new Promise<void>((resolve, reject) => {
    ws.on("message", (raw) => {
      const event = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      events.push(event);
      if (event.type === "response.completed" || event.type === "response.failed") {
        resolve();
      }
    });
    ws.once("error", reject);
    ws.once("close", () => reject(new Error("websocket closed before response.completed")));
  });
  ws.send(JSON.stringify(message));
  await done;
  return { events, close };
}

async function openWebsocket(): Promise<{ ws: WebSocket; close: () => Promise<void> }> {
  const wss = new WebSocketServer({ noServer: true });
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Resolved at call time (not baked into the shared `options` constant)
      // so it picks up whatever vi.stubGlobal("fetch", ...) each test
      // installed. together-client.ts's default fetch is undici's direct
      // import, not globalThis.fetch, so stubGlobal alone wouldn't reach it.
      handleCodexResponsesWebsocket(ws, { ...options, fetch: globalThis.fetch });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return {
    ws,
    close: async () => {
      ws.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function sseResponse(chunks: unknown[]): Response {
  const body =
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}
