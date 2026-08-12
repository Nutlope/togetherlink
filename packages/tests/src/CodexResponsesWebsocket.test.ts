import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexResponsesWebsocket } from "../../cli/src/lib/codex/responses-websocket.js";
import { nativeWebsocketUrl } from "../../cli/src/lib/codex/native-websocket-relay.js";
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

  test("keeps mixed native web search results out of assistant replies and restores them for continuation", async () => {
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    const togetherRequests: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("api.exa.ai/search")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  title: "LiveKit docs",
                  url: "https://docs.livekit.io/agents/",
                  text: "Search evidence available only to the model continuation.",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        const request = JSON.parse(String(init?.body)) as Record<string, any>;
        togetherRequests.push(request);
        if (togetherRequests.length === 1) {
          return sseResponse([
            {
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: "call_search",
                        type: "function",
                        function: {
                          name: "web_search",
                          arguments: JSON.stringify({ query: "LiveKit agents" }),
                        },
                      },
                      {
                        index: 1,
                        id: "call_exec",
                        type: "function",
                        function: {
                          name: "exec_command",
                          arguments: JSON.stringify({ cmd: "git status --short" }),
                        },
                      },
                    ],
                  },
                },
              ],
            },
            { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
          ]);
        }
        return sseResponse([
          { choices: [{ index: 0, delta: { content: "Final answer from both tools." } }] },
          {
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
          },
        ]);
      }),
    );

    const { ws, close } = await openWebsocket();
    try {
      const firstEvents = await collectTurn(ws, {
        type: "response.create",
        model: GLM_5_2.id,
        tools: [
          { type: "web_search", name: "web_search" },
          {
            type: "function",
            name: "exec_command",
            description: "Run a command.",
            parameters: {
              type: "object",
              properties: { cmd: { type: "string" } },
              required: ["cmd"],
            },
          },
        ],
        input: [{ type: "message", role: "user", content: "Research LiveKit." }],
      });

      expect(firstEvents.some((event) => event.type === "response.web_search_call.completed")).toBe(
        true,
      );
      expect(
        firstEvents.some(
          (event) =>
            event.type === "response.output_text.delta" &&
            String(event.delta).includes("Web search results for"),
        ),
      ).toBe(false);
      const firstCompleted = firstEvents.find((event) => event.type === "response.completed") as {
        response: { output: Array<Record<string, unknown>> };
      };
      expect(firstCompleted.response.output.map((item) => item.type)).toEqual([
        "web_search_call",
        "function_call",
      ]);

      const continuationEvents = await collectTurn(ws, {
        type: "response.create",
        model: GLM_5_2.id,
        previous_response_id: responseId(firstEvents),
        input: [
          {
            type: "function_call_output",
            call_id: "call_exec",
            output: "Local repository evidence.",
          },
        ],
      });

      expect(
        continuationEvents.some(
          (event) =>
            event.type === "response.output_text.delta" &&
            event.delta === "Final answer from both tools.",
        ),
      ).toBe(true);
      expect(togetherRequests).toHaveLength(2);
      const continuationMessages = togetherRequests[1]?.messages as Array<{
        role: string;
        content?: string;
      }>;
      expect(
        continuationMessages.some((message) =>
          message.content?.includes("Search evidence available only to the model continuation."),
        ),
      ).toBe(true);
      expect(
        continuationMessages.some((message) =>
          message.content?.includes("Local repository evidence."),
        ),
      ).toBe(true);
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

  test("relays a native (non-Together) model turn over a real upstream websocket", async () => {
    const upstream = await startFakeNativeUpstream();
    try {
      const { events, close } = await runWebsocketTurn(
        {
          type: "response.create",
          model: "gpt-5.2-codex",
          input: [{ type: "message", role: "user", content: "hello" }],
        },
        {
          nativeBaseUrl: upstream.httpBaseUrl,
          upgradeHeaders: {
            authorization: "Bearer native-chatgpt-token",
            "chatgpt-account-id": "acct_123",
            "openai-beta": "responses_websockets=2026-02-06",
            originator: "codex_cli_rs",
            session_id: "sess_abc",
            "user-agent": "codex-tui/0.146.0",
            // Must NOT leak upstream: not part of the relay whitelist.
            "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
            cookie: "session=secret",
          },
        },
      );
      try {
        // The client receives the upstream's native event frames verbatim.
        expect(events.map((event) => event.type)).toEqual([
          "response.created",
          "response.output_text.delta",
          "response.completed",
        ]);
        const completed = events[events.length - 1] as {
          response: { status: string; model: string };
        };
        expect(completed.response.status).toBe("completed");
        expect(completed.response.model).toBe("gpt-5.2-codex");

        // The upstream saw the turn as response.create with the model intact.
        const turn = await upstream.receivedTurn;
        expect(turn.type).toBe("response.create");
        expect(turn.model).toBe("gpt-5.2-codex");

        // Auth/session headers from the client's upgrade were relayed; the
        // beta flag is forced; untrusted headers were dropped.
        const headers = await upstream.receivedHeaders;
        expect(headers["authorization"]).toBe("Bearer native-chatgpt-token");
        expect(headers["chatgpt-account-id"]).toBe("acct_123");
        expect(headers["session_id"]).toBe("sess_abc");
        expect(headers["originator"]).toBe("codex_cli_rs");
        expect(headers["openai-beta"]).toContain("responses_websockets=");
        expect(headers["cookie"]).toBeUndefined();
      } finally {
        await close();
      }
    } finally {
      await upstream.close();
    }
  });

  test("preserves native prewarm and previous_response_id continuations on one websocket", async () => {
    const upstream = await startFakeNativeUpstream();
    try {
      const { ws, close } = await openWebsocket({
        nativeBaseUrl: upstream.httpBaseUrl,
        upgradeHeaders: {},
      });
      try {
        const prewarmEvents = await collectTurn(ws, {
          type: "response.create",
          model: "gpt-5.2-codex",
          input: [{ type: "message", role: "user", content: "hello" }],
          generate: false,
        });
        const prewarmId = responseId(prewarmEvents);

        const responseEvents = await collectTurn(ws, {
          type: "response.create",
          model: "gpt-5.2-codex",
          previous_response_id: prewarmId,
          input: [],
        });
        const response = responseId(responseEvents);

        const continuationEvents = await collectTurn(ws, {
          type: "response.create",
          model: "gpt-5.2-codex",
          previous_response_id: response,
          input: [{ type: "function_call_output", call_id: "call_1", output: "done" }],
        });

        expect(continuationEvents.at(-1)?.type).toBe("response.completed");
        expect(upstream.turns).toHaveLength(3);
        expect(upstream.turns[0]).toMatchObject({ generate: false });
        expect(upstream.turns[1]).toMatchObject({ previous_response_id: prewarmId });
        expect(upstream.turns[2]).toMatchObject({ previous_response_id: response });
      } finally {
        await close();
      }
    } finally {
      await upstream.close();
    }
  });

  test("forces the responses_websockets beta flag when the client upgrade lacks it", async () => {
    const upstream = await startFakeNativeUpstream();
    try {
      const { close } = await runWebsocketTurn(
        { type: "response.create", model: "gpt-5.2", input: [] },
        { nativeBaseUrl: upstream.httpBaseUrl, upgradeHeaders: {} },
      );
      await close();
      const headers = await upstream.receivedHeaders;
      expect(headers["openai-beta"]).toBe("responses_websockets=2026-02-06");
    } finally {
      await upstream.close();
    }
  });

  test("closes the downstream safely when the native upstream disappears abnormally", async () => {
    const upstream = await startFakeNativeUpstream({ terminateAfterMessage: true });
    try {
      const { ws, close } = await openWebsocket({ nativeBaseUrl: upstream.httpBaseUrl });
      try {
        const closed = new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("downstream websocket stayed open after upstream termination")),
            1_000,
          );
          ws.once("close", (code) => {
            clearTimeout(timeout);
            resolve(code);
          });
          ws.once("error", reject);
        });
        ws.send(
          JSON.stringify({
            type: "response.create",
            model: "gpt-5.2-codex",
            input: [{ type: "message", role: "user", content: "hello" }],
          }),
        );

        expect(await closed).toBe(1006);
      } finally {
        await close();
      }
    } finally {
      await upstream.close();
    }
  });

  test("keeps the Together HTTP/SSE path when nativeBaseUrl is not configured", async () => {
    const fetchSpy = vi.fn(async () =>
      sseResponse([
        { choices: [{ index: 0, delta: { content: "hi" } }] },
        {
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // No nativeBaseUrl: even an unknown model id must stay on the HTTP/SSE
    // proxy path (which resolves it to the session default model), never a
    // websocket dial.
    const { ws, close } = await openWebsocket();
    try {
      const events: Array<Record<string, unknown>> = [];
      const done = new Promise<void>((resolve) => {
        ws.on("message", (raw) => {
          const event = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
          events.push(event);
          if (
            event.type === "response.completed" ||
            event.type === "response.failed" ||
            event.type === "error"
          ) {
            resolve();
          }
        });
      });
      ws.send(
        JSON.stringify({
          type: "response.create",
          model: "gpt-5.2-codex",
          input: [{ type: "message", role: "user", content: "hello" }],
        }),
      );
      await done;
      expect(events.some((event) => event.type === "response.completed")).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      await close();
    }
  });

  test("switches from a Together turn to a native model without leaking previous_response_id", async () => {
    const upstream = await startFakeNativeUpstream();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          {
            choices: [
              {
                index: 0,
                delta: { reasoning_content: "thinking", content: "together hi" },
              },
            ],
          },
          {
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
          },
        ]),
      ),
    );
    try {
      const { ws, close } = await openWebsocket({
        nativeBaseUrl: upstream.httpBaseUrl,
        upgradeHeaders: {},
      });
      try {
        const togetherEvents = await collectTurn(ws, {
          type: "response.create",
          model: GLM_5_2.id,
          input: [{ type: "message", role: "user", content: "hello" }],
        });
        const togetherResponseId = responseId(togetherEvents);

        // Mid-thread model switch: the client chains off the Together-minted
        // response id. The native relay must not forward it — the upstream
        // ChatGPT backend cannot resolve it.
        const nativeEvents = await collectTurn(ws, {
          type: "response.create",
          model: "gpt-5.2-codex",
          store: false,
          previous_response_id: togetherResponseId,
          input: [{ type: "message", role: "user", content: "switch models" }],
        });
        expect(nativeEvents.at(-1)?.type).toBe("response.completed");

        const turn = await upstream.receivedTurn;
        expect(turn.type).toBe("response.create");
        expect(turn.model).toBe("gpt-5.2-codex");
        expect(turn.store).toBe(false);
        expect(turn.previous_response_id).toBeUndefined();
        const reasoning = (turn.input as Array<Record<string, unknown>>).find(
          (item) => item.type === "reasoning",
        );
        expect(reasoning).toEqual({
          type: "reasoning",
          status: "completed",
          summary: [{ type: "summary_text", text: "thinking" }],
          content: [],
        });
      } finally {
        await close();
      }
    } finally {
      await upstream.close();
    }
  });
});

test("nativeWebsocketUrl maps the native base URL onto wss/ws /responses", () => {
  expect(nativeWebsocketUrl("https://chatgpt.com/backend-api/codex")).toBe(
    "wss://chatgpt.com/backend-api/codex/responses",
  );
  expect(nativeWebsocketUrl("https://chatgpt.com/backend-api/codex/")).toBe(
    "wss://chatgpt.com/backend-api/codex/responses",
  );
  expect(nativeWebsocketUrl("http://127.0.0.1:9999/backend-api/codex")).toBe(
    "ws://127.0.0.1:9999/backend-api/codex/responses",
  );
});

type FakeNativeUpstream = {
  httpBaseUrl: string;
  receivedTurn: Promise<Record<string, unknown>>;
  receivedHeaders: Promise<http.IncomingHttpHeaders>;
  turns: Array<Record<string, unknown>>;
  close: () => Promise<void>;
};

/** Minimal stand-in for wss://chatgpt.com/backend-api/codex/responses. */
async function startFakeNativeUpstream(
  options: { terminateAfterMessage?: boolean } = {},
): Promise<FakeNativeUpstream> {
  const wss = new WebSocketServer({ noServer: true });
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  let resolveTurn!: (turn: Record<string, unknown>) => void;
  let resolveHeaders!: (headers: http.IncomingHttpHeaders) => void;
  const receivedTurn = new Promise<Record<string, unknown>>((resolve) => {
    resolveTurn = resolve;
  });
  const receivedHeaders = new Promise<http.IncomingHttpHeaders>((resolve) => {
    resolveHeaders = resolve;
  });
  const turns: Array<Record<string, unknown>> = [];
  server.on("upgrade", (req, socket, head) => {
    resolveHeaders(req.headers);
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on("message", (raw) => {
        const turn = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
        turns.push(turn);
        resolveTurn(turn);
        if (options.terminateAfterMessage) {
          ws.terminate();
          return;
        }
        const model = typeof turn.model === "string" ? turn.model : "unknown";
        ws.send(
          JSON.stringify({
            type: "response.created",
            response: { id: "resp_native", status: "in_progress", model, output: [] },
          }),
        );
        ws.send(
          JSON.stringify({
            type: "response.output_text.delta",
            delta: "native hi",
          }),
        );
        ws.send(
          JSON.stringify({
            type: "response.completed",
            response: { id: "resp_native", status: "completed", model, output: [] },
          }),
        );
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    httpBaseUrl: `http://127.0.0.1:${port}/backend-api/codex`,
    receivedTurn,
    receivedHeaders,
    turns,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function runWebsocketTurn(
  message: Record<string, unknown>,
  extras: {
    nativeBaseUrl?: string;
    upgradeHeaders?: Record<string, string>;
  } = {},
): Promise<{ events: Array<Record<string, unknown>>; close: () => Promise<void> }> {
  const { ws, close } = await openWebsocket(extras);
  const events: Array<Record<string, unknown>> = [];
  const done = new Promise<void>((resolve, reject) => {
    ws.on("message", (raw) => {
      const event = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      events.push(event);
      if (
        event.type === "response.completed" ||
        event.type === "response.failed" ||
        event.type === "error"
      ) {
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

async function openWebsocket(
  extras: {
    nativeBaseUrl?: string;
    upgradeHeaders?: Record<string, string>;
  } = {},
): Promise<{ ws: WebSocket; close: () => Promise<void> }> {
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
      handleCodexResponsesWebsocket(
        ws,
        {
          ...options,
          fetch: globalThis.fetch,
          ...(extras.nativeBaseUrl ? { nativeBaseUrl: extras.nativeBaseUrl } : {}),
        },
        extras.upgradeHeaders ?? {},
      );
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

function collectTurn(
  ws: WebSocket,
  message: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  return new Promise((resolve, reject) => {
    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      events.push(event);
      if (
        event.type === "response.completed" ||
        event.type === "response.failed" ||
        event.type === "error"
      ) {
        ws.off("message", onMessage);
        resolve(events);
      }
    };
    ws.on("message", onMessage);
    ws.once("error", reject);
    ws.send(JSON.stringify(message));
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
