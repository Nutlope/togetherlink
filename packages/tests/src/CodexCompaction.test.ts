import http from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";

const realFetch = globalThis.fetch.bind(globalThis);

const options: CodexProxyOptions = {
  apiKey: "test-together-key",
  baseUrl: "https://api.together.ai/v1",
  modelId: GLM_5_2.id,
  targetModelId: GLM_5_2.id,
  modelName: GLM_5_2.name,
  modelDefinition: GLM_5_2,
  authToken: "test-token",
};

describe("Codex compaction compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("v2 non-stream compaction returns exactly one compaction item instead of reasoning and message items", async () => {
    const upstreamBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        upstreamBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [
            {
              message: {
                reasoning_content: "I should retain the important state.",
                content: "Durable continuation summary.",
                tool_calls: [
                  {
                    id: "call_must_not_escape",
                    type: "function",
                    function: { name: "dangerous_tool", arguments: "{}" },
                  },
                ],
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        });
      }),
    );

    const response = await postCodexPath("/v1/responses", {
      model: GLM_5_2.id,
      stream: false,
      tools: [{ type: "function", name: "dangerous_tool", parameters: { type: "object" } }],
      input: [message("user", "Preserve marker BLUE-CHAIR-8273."), { type: "compaction_trigger" }],
    });

    expect(response.output).toHaveLength(1);
    expect(response.output).toEqual([
      expect.objectContaining({
        type: "compaction",
        encrypted_content: expect.stringMatching(/^tlc1:/),
      }),
    ]);
    expect(response.output.filter((item: any) => item.type === "compaction")).toHaveLength(1);
    expect(response.output.some((item: any) => ["reasoning", "message"].includes(item.type))).toBe(
      false,
    );
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.tools).toEqual([]);
    expect(upstreamBodies[0]?.tool_choice).toBe("none");
    expect(upstreamBodies[0]?.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("trigger") }),
      ]),
    );
  });

  test("v2 streaming compaction emits one compaction item and no ordinary output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return jsonResponse({
          choices: [
            { message: { content: "Streaming continuation summary." }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 8, total_tokens: 48 },
        });
      }),
    );

    const raw = await postCodexPathText("/v1/responses", {
      model: GLM_5_2.id,
      stream: true,
      input: [message("user", "Keep the streaming state."), { type: "compaction_trigger" }],
    });
    const events = responsesSseEvents(raw);
    const doneItems = events
      .filter((event) => event.type === "response.output_item.done")
      .map((event) => event.item as Record<string, unknown>);
    const completed = events.find((event) => event.type === "response.completed");
    const completedOutput = (completed?.response as Record<string, any> | undefined)?.output;

    expect(doneItems).toEqual([
      expect.objectContaining({
        type: "compaction",
        encrypted_content: expect.stringMatching(/^tlc1:/),
      }),
    ]);
    expect(completedOutput).toHaveLength(1);
    expect(completedOutput[0]?.type).toBe("compaction");
    expect(
      events.some((event) =>
        ["response.reasoning_text.delta", "response.output_text.delta"].includes(
          String(event.type),
        ),
      ),
    ).toBe(false);
  });

  test("rejects an empty upstream summary instead of replacing the conversation history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return jsonResponse({
          choices: [{ message: { content: "   " }, finish_reason: "stop" }],
          usage: { prompt_tokens: 40, completion_tokens: 0, total_tokens: 40 },
        });
      }),
    );

    const response = await postCodexResponse("/v1/responses", {
      model: GLM_5_2.id,
      stream: false,
      input: [message("user", "History that must remain intact."), { type: "compaction_trigger" }],
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Together returned an empty compaction summary.",
    });
  });

  test("v1 compaction returns bounded replacement history ending in a continuation summary", async () => {
    const upstreamBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        upstreamBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "V1 durable summary." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
        });
      }),
    );

    const response = await postCodexPath("/v1/responses/compact", {
      model: GLM_5_2.id,
      input: [
        message("user", "x".repeat(90_000)),
        message("assistant", "old answer"),
        message("user", "Newest user constraint."),
      ],
      tools: [{ type: "function", name: "dangerous_tool", parameters: { type: "object" } }],
    });

    expect(response.output.length).toBeGreaterThan(1);
    expect(
      response.output.every((item: any) => item.type === "message" && item.role === "user"),
    ).toBe(true);
    const retainedText = response.output
      .slice(0, -1)
      .flatMap((item: any) => item.content)
      .map((part: any) => part.text)
      .join("");
    expect(retainedText.length).toBeLessThanOrEqual(80_000);
    expect(retainedText).toContain("Newest user constraint.");
    expect(response.output.at(-1)?.content[0]?.text).toContain("V1 durable summary.");
    expect(upstreamBodies[0]?.tools).toEqual([]);
    expect(upstreamBodies[0]?.tool_choice).toBe("none");
  });

  test("replays TogetherLink-owned compaction to Together as explicit continuation context", async () => {
    const upstreamBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        upstreamBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "Resumed." }, finish_reason: "stop" }],
        });
      }),
    );

    await postCodexPath("/v1/responses", {
      model: GLM_5_2.id,
      stream: false,
      input: [
        {
          type: "compaction",
          id: "cmp_owned",
          encrypted_content: `tlc1:${Buffer.from("Owned marker ORANGE-LAMP-991.").toString("base64")}`,
        },
        message("user", "Continue."),
      ],
    });

    expect(upstreamBodies[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Owned marker ORANGE-LAMP-991."),
        }),
      ]),
    );
  });

  test("replays genuine OpenAI compaction to Together as an unreadable-history placeholder", async () => {
    const upstreamBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        upstreamBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "Continued safely." }, finish_reason: "stop" }],
        });
      }),
    );

    await postCodexPath("/v1/responses", {
      model: GLM_5_2.id,
      stream: false,
      input: [
        {
          type: "compaction",
          id: "cmp_openai",
          encrypted_content: "gAAAAAB-openai-opaque-content",
        },
        message("user", "Continue."),
      ],
    });

    expect(upstreamBodies[0]?.messages).toEqual(
      expect.arrayContaining([
        {
          role: "user",
          content: "[Earlier conversation history was compacted in an unreadable OpenAI format.]",
        },
      ]),
    );
  });

  test("forwards native OpenAI v1 and v2 compaction controls to the native backend", async () => {
    const nativeRequests: Array<{ url: string; body: Record<string, any> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        nativeRequests.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse({ route: "native" });
      }),
    );
    const nativeOptions = {
      ...options,
      nativeBaseUrl: "https://chatgpt.com/backend-api/codex",
    };
    const opaqueCompaction = {
      type: "compaction",
      id: "cmp_openai",
      encrypted_content: "gAAAAAB-openai-opaque-content",
    };

    await postCodexPath(
      "/v1/responses/compact",
      { model: "gpt-5.6-sol", input: [opaqueCompaction] },
      nativeOptions,
    );
    await postCodexPath(
      "/v1/responses",
      {
        model: "gpt-5.6-sol",
        stream: false,
        input: [message("user", "Compact natively."), { type: "compaction_trigger" }],
      },
      nativeOptions,
    );

    expect(nativeRequests.map((request) => request.url)).toEqual([
      "https://chatgpt.com/backend-api/codex/responses/compact",
      "https://chatgpt.com/backend-api/codex/responses",
    ]);
    expect(nativeRequests[0]?.body.input).toEqual([opaqueCompaction]);
    expect(nativeRequests[1]?.body.input.at(-1)).toEqual({ type: "compaction_trigger" });
  });

  test("decodes TogetherLink compaction for native replay while preserving OpenAI compaction", async () => {
    const nativeBodies: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        nativeBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ route: "native" });
      }),
    );
    const nativeCompaction = {
      type: "compaction",
      id: "cmp_openai",
      encrypted_content: "gAAAAAB-openai-opaque-content",
    };

    await postCodexPath(
      "/v1/responses",
      {
        model: "gpt-5.6-sol",
        stream: false,
        input: [
          {
            type: "compaction",
            id: "cmp_owned",
            encrypted_content: `tlc1:${Buffer.from("Native replay marker SILVER-KEY-12.").toString("base64")}`,
          },
          nativeCompaction,
          message("user", "Continue with GPT."),
        ],
      },
      { ...options, nativeBaseUrl: "https://chatgpt.com/backend-api/codex" },
    );

    expect(nativeBodies[0]?.input[0]).toEqual(
      expect.objectContaining({
        type: "message",
        role: "user",
        content: [
          expect.objectContaining({
            type: "input_text",
            text: expect.stringContaining("Native replay marker SILVER-KEY-12."),
          }),
        ],
      }),
    );
    expect(nativeBodies[0]?.input[1]).toEqual(nativeCompaction);
  });
});

function message(role: "user" | "assistant", text: string): Record<string, unknown> {
  return {
    type: "message",
    role,
    content: [{ type: role === "user" ? "input_text" : "output_text", text }],
  };
}

async function postCodexPath(
  path: string,
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<Record<string, any>> {
  return JSON.parse(await postCodexPathText(path, body, proxyOptions)) as Record<string, any>;
}

async function postCodexPathText(
  path: string,
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<string> {
  const response = await postCodexResponse(path, body, proxyOptions);
  expect(response.ok).toBe(true);
  return await response.text();
}

async function postCodexResponse(
  path: string,
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<Response> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, { ...proxyOptions, fetch: globalThis.fetch }).catch(
      (error) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("test server did not bind");
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function responsesSseEvents(raw: string): Array<Record<string, any>> {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice("data: ".length)) as Record<string, any>);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
