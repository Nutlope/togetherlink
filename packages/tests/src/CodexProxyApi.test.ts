import http from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";

const realFetch = globalThis.fetch.bind(globalThis);

const options: CodexProxyOptions = {
  apiKey: "test-together-key",
  modelId: GLM_5_2.id,
  targetModelId: GLM_5_2.id,
  modelName: GLM_5_2.name,
  modelDefinition: GLM_5_2,
  authToken: "test-token",
};

describe("Codex Responses proxy tool compatibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("maps custom tool calls back to Codex custom_tool_call items", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({
        id: "chatcmpl_custom",
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_patch",
                  type: "function",
                  function: {
                    name: "apply_patch",
                    arguments: JSON.stringify({ input: "*** Begin Patch\n*** End Patch\n" }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      });
    }));

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [
        {
          type: "custom",
          name: "apply_patch",
          description: "Apply a patch.",
          format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
        },
      ],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Patch it." }] }],
    });

    expect(response.output).toEqual([
      {
        id: expect.stringMatching(/^ctc_/),
        type: "custom_tool_call",
        status: "completed",
        call_id: "call_patch",
        name: "apply_patch",
        input: "*** Begin Patch\n*** End Patch\n",
      },
    ]);
    expect(firstToolName(requests)).toBe("apply_patch");
  });

  test("flattens namespace tools for Together and restores namespace in Codex output", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_agent",
                  type: "function",
                  function: {
                    name: "multi_agent_v1__spawn_agent",
                    arguments: JSON.stringify({ task: "inspect the repo" }),
                  },
                },
              ],
            },
          },
        ],
      });
    }));

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [
        {
          type: "namespace",
          name: "multi_agent_v1",
          description: "Spawn and manage sub-agents.",
          tools: [
            {
              type: "function",
              name: "spawn_agent",
              description: "Start a sub-agent.",
              parameters: {
                type: "object",
                properties: { task: { type: "string" } },
                required: ["task"],
              },
            },
          ],
        },
      ],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Use an agent." }] }],
    });

    expect(firstToolName(requests)).toBe("multi_agent_v1__spawn_agent");
    expect(response.output).toEqual([
      {
        id: expect.stringMatching(/^fc_/),
        type: "function_call",
        status: "completed",
        call_id: "call_agent",
        namespace: "multi_agent_v1",
        name: "spawn_agent",
        arguments: JSON.stringify({ task: "inspect the repo" }),
      },
    ]);
  });

  test("preserves parallel namespace tool-call groups when continuing streamed responses", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return sseResponse([
        {
          choices: [{ delta: { content: "Hello World" } }],
        },
        { choices: [{ finish_reason: "stop", delta: {} }] },
      ]);
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [
        {
          type: "namespace",
          name: "multi_agent_v1",
          description: "Spawn and manage sub-agents.",
          tools: [
            {
              type: "function",
              name: "spawn_agent",
              description: "Start a sub-agent.",
              parameters: {
                type: "object",
                properties: { task: { type: "string" } },
                required: ["task"],
              },
            },
          ],
        },
      ],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Use two agents." }] },
        {
          type: "function_call",
          namespace: "multi_agent_v1",
          name: "spawn_agent",
          call_id: "call_hello",
          arguments: JSON.stringify({ task: "Say Hello." }),
        },
        {
          type: "function_call",
          namespace: "multi_agent_v1",
          name: "spawn_agent",
          call_id: "call_world",
          arguments: JSON.stringify({ task: "Say World." }),
        },
        { type: "function_call_output", call_id: "call_hello", output: "Hello" },
        { type: "function_call_output", call_id: "call_world", output: "World" },
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{ role: string; tool_call_id?: string; tool_calls?: Array<{ id: string; function: { name: string } }> }>;
    };
    expect(upstream.messages).toEqual(
      expect.arrayContaining([
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_hello",
              type: "function",
              function: { name: "multi_agent_v1__spawn_agent", arguments: JSON.stringify({ task: "Say Hello." }) },
            },
            {
              id: "call_world",
              type: "function",
              function: { name: "multi_agent_v1__spawn_agent", arguments: JSON.stringify({ task: "Say World." }) },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_hello", content: "Hello" },
        { role: "tool", tool_call_id: "call_world", content: "World" },
      ]),
    );
    expect(response).toContain("response.completed");
  });

  test("runs web_search internally with Exa and returns the final assistant answer", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      const body = JSON.parse(String(init?.body));
      requests.push({ url, body });
      if (url.includes("api.exa.ai")) {
        return jsonResponse({
          results: [{ title: "Codex docs", url: "https://developers.openai.com/codex", text: "Codex helps with coding." }],
        });
      }
      if (requests.filter((request) => request.url.includes("api.together.ai")).length === 1) {
        return jsonResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_search",
                    type: "function",
                    function: { name: "web_search", arguments: JSON.stringify({ query: "Codex docs" }) },
                  },
                ],
              },
            },
          ],
        });
      }
      return jsonResponse({
        choices: [{ message: { content: "Codex docs: https://developers.openai.com/codex" } }],
      });
    }));

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Search Codex docs." }] }],
    });

    expect(requests.some((request) => request.url.includes("api.exa.ai/search"))).toBe(true);
    expect(response.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Codex docs: https://developers.openai.com/codex", annotations: [] }],
    });
  });

  test("does not continue native-tool loop when a client tool call is returned in the same group", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      const body = JSON.parse(String(init?.body));
      requests.push({ url, body });
      if (url.includes("api.exa.ai")) {
        return jsonResponse({
          results: [{ title: "Codex docs", url: "https://developers.openai.com/codex", text: "Codex helps with coding." }],
        });
      }
      return jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_search",
                  type: "function",
                  function: { name: "web_search", arguments: JSON.stringify({ query: "Codex docs" }) },
                },
                {
                  id: "call_patch",
                  type: "function",
                  function: { name: "apply_patch", arguments: JSON.stringify({ input: "*** Begin Patch\n*** End Patch\n" }) },
                },
              ],
            },
          },
        ],
      });
    }));

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [
        { type: "web_search", name: "web_search" },
        {
          type: "custom",
          name: "apply_patch",
          description: "Apply a patch.",
          format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
        },
      ],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Search and patch." }] }],
    });

    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(1);
    expect(requests.some((request) => request.url.includes("api.exa.ai"))).toBe(false);
    expect(response.output).toEqual([
      {
        id: expect.stringMatching(/^fc_/),
        type: "function_call",
        status: "completed",
        call_id: "call_search",
        name: "web_search",
        arguments: JSON.stringify({ query: "Codex docs" }),
      },
      {
        id: expect.stringMatching(/^ctc_/),
        type: "custom_tool_call",
        status: "completed",
        call_id: "call_patch",
        name: "apply_patch",
        input: "*** Begin Patch\n*** End Patch\n",
      },
    ]);
  });

  test("forwards Responses input_image parts to Together vision message content", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({
        choices: [{ message: { content: "I can see the image." } }],
      });
    }));

    await postResponses({
      model: GLM_5_2.id,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "Describe this." },
            { type: "input_image", image_url: "data:image/png;base64,abc123", detail: "high" },
          ],
        },
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{ role: string; content?: unknown }>;
    };
    expect(upstream.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Describe this." },
        { type: "image_url", image_url: { url: "data:image/png;base64,abc123", detail: "high" } },
      ],
    });
  });

  test("translates forced namespace tool_choice to the flattened Together tool name", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({
        choices: [{ message: { content: "ok" } }],
      });
    }));

    await postResponses({
      model: GLM_5_2.id,
      tool_choice: { type: "function", name: "spawn_agent" },
      tools: [
        {
          type: "namespace",
          name: "multi_agent_v1",
          tools: [{ type: "function", name: "spawn_agent", parameters: { type: "object", properties: {} } }],
        },
      ],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Use the agent." }] }],
    });

    const upstream = requests[0] as { tool_choice?: unknown };
    expect(upstream.tool_choice).toEqual({ type: "function", function: { name: "multi_agent_v1__spawn_agent" } });
  });
});

async function postResponses(body: unknown): Promise<Record<string, any>> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, options).catch((error) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("test server did not bind");
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return (await response.json()) as Record<string, any>;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postResponsesText(body: unknown): Promise<string> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, options).catch((error) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("test server did not bind");
  }
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return await response.text();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(chunks: unknown[]): Response {
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function firstToolName(requests: unknown[]): string | undefined {
  const request = requests[0] as { tools?: Array<{ function?: { name?: string } }> } | undefined;
  return request?.tools?.[0]?.function?.name;
}
