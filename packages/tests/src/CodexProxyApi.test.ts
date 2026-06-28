import http from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2, MINIMAX_M3, QWEN_3_5_9B, QWEN_3_7_MAX } from "@togetherlink/models";
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
    vi.unstubAllEnvs();
  });

  test("serves the full Codex Desktop model catalog from /v1/models", async () => {
    const catalog = await getModels();
    const first = catalog.models?.[0] as Record<string, unknown> | undefined;

    expect(first?.slug).toBe(GLM_5_2.id);
    expect(first?.display_name).toBe("GLM 5.2 · default");
    expect(first?.default_reasoning_level).toBe("medium");
    expect(first?.default_reasoning_summary).toBe("auto");
    expect(first?.model_messages).toEqual(expect.objectContaining({
      instructions_template: expect.stringContaining("{{ personality }}"),
    }));
    expect(first?.apply_patch_tool_type).toBe("freeform");
    expect(first?.web_search_tool_type).toBe("text_and_image");
    expect(first?.truncation_policy).toEqual({ mode: "tokens", limit: GLM_5_2.limit.context });
    expect(first?.comp_hash).toBeNull();
    expect(first?.use_responses_lite).toBe(false);
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

  test("keeps streamed client tool calls in Codex-compatible completed item events", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      return sseResponse([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_alpha",
                    type: "function",
                    function: { name: "multi_agent_v1__spawn_agent", arguments: "{\"task\":\"Say " },
                  },
                  {
                    index: 1,
                    id: "call_beta",
                    type: "function",
                    function: { name: "multi_agent_v1__spawn_agent", arguments: "{\"task\":\"Say " },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: "alpha\"}" } },
                  { index: 1, function: { arguments: "beta\"}" } },
                ],
              },
            },
          ],
        },
        { choices: [{ finish_reason: "tool_calls", delta: {} }] },
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
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Use two agents." }] }],
    });

    const firstAdded = response.indexOf('"call_id":"call_alpha"');
    const secondAdded = response.indexOf('"call_id":"call_beta"');
    const completed = response.indexOf("response.completed");
    expect(firstAdded).toBeGreaterThan(-1);
    expect(secondAdded).toBeGreaterThan(-1);
    expect(completed).toBeGreaterThan(secondAdded);
    expect(response).not.toContain("response.function_call_arguments.delta");
    expect(response).not.toContain("response.function_call_arguments.done");
    expect(response).toContain('"arguments":"{\\"task\\":\\"Say alpha\\"}"');
    expect(response).toContain('"arguments":"{\\"task\\":\\"Say beta\\"}"');
  });

  test("parses CRLF-delimited upstream SSE streams", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      return sseResponse([
        { choices: [{ delta: { content: "hi" } }] },
        { choices: [{ finish_reason: "stop", delta: {} }] },
      ], { lineEnding: "\r\n" });
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] }],
    });

    expect(response).toContain("response.output_text.delta");
    expect(response).toContain("hi");
    expect(response).toContain("response.completed");
  });

  test("streams ordinary Codex turns upstream by default", async () => {
    const requests: Array<{ body: any }> = [];
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push({ body: JSON.parse(String(init?.body)) });
      return sseResponse([
        { choices: [{ delta: { content: "hi" } }] },
        { choices: [{ finish_reason: "stop", delta: {} }] },
        { usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } },
      ]);
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] }],
    });

    expect(requests[0]?.body.stream).toBe(true);
    expect(response).toContain("response.output_text.delta");
    expect(response).toContain('"sequence_number":');
    expect(response).toContain("response.content_part.done");
    expect(response).toContain("response.completed");
  });

  test("forwards streamed Codex deltas before the response completes", async () => {
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      return delayedSseResponse([
        { delayMs: 0, chunk: { choices: [{ delta: { content: "hel" } }] } },
        { delayMs: 80, chunk: { choices: [{ delta: { content: "lo" } }] } },
        { delayMs: 80, chunk: { choices: [{ finish_reason: "stop", delta: {} }] } },
        { delayMs: 80, chunk: { usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } } },
      ]);
    }));

    const timeline = await postResponsesStreamingTimeline({
      model: GLM_5_2.id,
      stream: true,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hello." }] }],
    });

    const firstDelta = timeline.find((entry) => entry.text.includes("response.output_text.delta"));
    const completed = timeline.find((entry) => entry.text.includes("response.completed"));
    expect(firstDelta?.atMs).toBeDefined();
    expect(completed?.atMs).toBeDefined();
    expect(timeline.some((entry) => entry.text.includes("response.in_progress"))).toBe(true);
    expect(timeline.some((entry) => entry.text.includes("response.content_part.done"))).toBe(true);
    expect(firstDelta!.atMs).toBeLessThan(completed!.atMs);
    expect(completed!.atMs - firstDelta!.atMs).toBeGreaterThanOrEqual(50);
  });

  test("preserves namespace tool-call groups with more than five parallel calls", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return sseResponse([
        {
          choices: [{ delta: { content: "A B C D E F" } }],
        },
        { choices: [{ finish_reason: "stop", delta: {} }] },
      ]);
    }));

    const calls = ["A", "B", "C", "D", "E", "F"].map((letter) => ({
      type: "function_call",
      namespace: "multi_agent_v1",
      name: "spawn_agent",
      call_id: `call_${letter.toLowerCase()}`,
      arguments: JSON.stringify({ task: `Say ${letter}.` }),
    }));
    const outputs = ["A", "B", "C", "D", "E", "F"].map((letter) => ({
      type: "function_call_output",
      call_id: `call_${letter.toLowerCase()}`,
      output: letter,
    }));

    await postResponsesText({
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
        { type: "message", role: "user", content: [{ type: "input_text", text: "Use six agents." }] },
        ...calls,
        ...outputs,
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{ role: string; tool_call_id?: string; tool_calls?: Array<{ id: string; function: { name: string } }> }>;
    };
    const assistantToolGroup = upstream.messages.find((message) => message.role === "assistant" && message.tool_calls);
    expect(assistantToolGroup?.tool_calls).toHaveLength(6);
    expect(assistantToolGroup?.tool_calls?.map((toolCall) => toolCall.id)).toEqual([
      "call_a",
      "call_b",
      "call_c",
      "call_d",
      "call_e",
      "call_f",
    ]);
    expect(assistantToolGroup?.tool_calls?.every((toolCall) => toolCall.function.name === "multi_agent_v1__spawn_agent")).toBe(true);
    expect(upstream.messages.filter((message) => message.role === "tool").map((message) => message.tool_call_id)).toEqual([
      "call_a",
      "call_b",
      "call_c",
      "call_d",
      "call_e",
      "call_f",
    ]);
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

  test("streams native web_search thinking and final answer deltas instead of buffering", async () => {
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
      const togetherRequestCount = requests.filter((request) => request.url.includes("api.together.ai")).length;
      if (togetherRequestCount === 1) {
        return sseResponse([
          { choices: [{ delta: { reasoning_content: "Need current docs. " } }] },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_search",
                      type: "function",
                      function: { name: "web_search", arguments: JSON.stringify({ query: "Codex docs" }) },
                    },
                  ],
                },
              },
            ],
          },
          { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        ]);
      }
      return sseResponse([
        { choices: [{ delta: { reasoning_content: "Found it. " } }] },
        { choices: [{ delta: { content: "Codex docs: " } }] },
        { choices: [{ delta: { content: "https://developers.openai.com/codex" } }] },
        { choices: [{ finish_reason: "stop", delta: {} }] },
        { usage: { prompt_tokens: 15, completion_tokens: 7, total_tokens: 22 } },
      ]);
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Search Codex docs." }] }],
    });

    const reasoningIndex = response.indexOf("response.reasoning_text.delta");
    const textIndex = response.indexOf("response.output_text.delta");
    const completedIndex = response.indexOf("response.completed");
    expect(reasoningIndex).toBeGreaterThan(-1);
    expect(textIndex).toBeGreaterThan(-1);
    expect(completedIndex).toBeGreaterThan(textIndex);
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(2);
    expect(requests.some((request) => request.url.includes("api.exa.ai/search"))).toBe(true);
    expect(requests[2]?.body.messages.at(-1)).toMatchObject({
      role: "tool",
      tool_call_id: "call_search",
      content: expect.stringContaining("Codex docs"),
    });
  });

  test("fails streamed native web_search completion when upstream SSE goes idle", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS", "100");
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
      return hangingSseResponse([{ choices: [{ delta: {} }] }]);
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] }],
    });

    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream produced no SSE event for 100ms.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(1);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("fails when upstream SSE keepalives make no Codex progress", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push({ url, body: JSON.parse(String(init?.body)) });
      return noProgressSseResponse();
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] }],
    });

    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream produced no SSE event for 100ms.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(1);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("fails when native stream emits reasoning but never final output", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_TURN_TIMEOUT_MS", "100");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push({ url, body: JSON.parse(String(init?.body)) });
      return reasoningOnlySseResponse();
    }));

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] }],
    });

    expect(response).toContain("response.reasoning_text.delta");
    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream produced no SSE event for 100ms.");
    expect(response).not.toContain("Recovered after reasoning timeout.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(1);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("does not leak native web_search when a client tool call is returned in the same group", async () => {
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
        {
          type: "function",
          name: "web_search",
          description: "Search the web.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
        },
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
    expect(requests.some((request) => request.url.includes("api.exa.ai"))).toBe(true);
    expect(response.output).toEqual([
      {
        id: expect.stringMatching(/^msg_/),
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: expect.stringContaining("Web search results for \"Codex docs\" via Exa"),
            annotations: [],
          },
        ],
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

  test("routes Desktop per-turn vision model selections instead of the session default", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return sseResponse([
        { choices: [{ delta: { content: "I can see the image." }, finish_reason: "stop" }] },
      ]);
    }));

    const response = await postResponsesText({
      model: QWEN_3_7_MAX.id,
      stream: true,
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
    expect(response).toContain("response.completed");

    const upstream = requests[0] as {
      model?: string;
      messages: Array<{ role: string; content?: unknown }>;
    };
    expect(upstream.model).toBe(QWEN_3_7_MAX.id);
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

  test("maps Together reasoning token usage into Responses usage details", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      return jsonResponse({
        choices: [{ message: { content: "943" } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 7,
          total_tokens: 19,
          completion_tokens_details: { reasoning_tokens: 5 },
        },
      });
    }));

    const response = await postResponses({
      model: GLM_5_2.id,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Think." }] }],
    });

    expect(response.usage).toEqual({
      input_tokens: 12,
      output_tokens: 7,
      total_tokens: 19,
      output_tokens_details: { reasoning_tokens: 5 },
    });
  });

  test("routes Codex memory extraction requests to the default long-context Together model", async () => {
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
              content: JSON.stringify({
                rollout_summary: "Captured TogetherLink memory support investigation.",
                rollout_slug: "togetherlink_codex_memory_support",
                raw_memory: "TogetherLink should route Codex memory extraction separately from the main coding model.",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
      });
    }));

    const response = await postResponses({
      model: "gpt-5.4-mini",
      instructions: "## Memory Writing Agent: Phase 1 (Single Rollout)\n\nYou are a Memory Writing Agent.",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Analyze this rollout." }] }],
      text: {
        format: {
          type: "json_schema",
          strict: true,
          name: "codex_output_schema",
          schema: {
            type: "object",
            properties: {
              rollout_summary: { type: "string" },
              rollout_slug: { type: ["string", "null"] },
              raw_memory: { type: "string" },
            },
            required: ["rollout_summary", "rollout_slug", "raw_memory"],
            additionalProperties: false,
          },
        },
      },
    });

    const upstream = requests[0] as { model?: string; response_format?: unknown };
    expect(upstream.model).toBe(MINIMAX_M3.id);
    expect(upstream.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "codex_output_schema",
        strict: true,
        schema: {
          type: "object",
          properties: {
            rollout_summary: { type: "string" },
            rollout_slug: { type: ["string", "null"] },
            raw_memory: { type: "string" },
          },
          required: ["rollout_summary", "rollout_slug", "raw_memory"],
          additionalProperties: false,
        },
      },
    });
    expect(response.model).toBe("gpt-5.4-mini");
  });

  test("allows Codex memory extraction model override from env", async () => {
    const requests: unknown[] = [];
    vi.stubEnv("TOGETHERLINK_CODEX_MEMORY_MODEL", QWEN_3_5_9B.id);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      requests.push(JSON.parse(String(init?.body)));
      return jsonResponse({ choices: [{ message: { content: "{}" } }] });
    }));

    await postResponses({
      model: "gpt-5.4-mini",
      instructions: "## Memory Writing Agent: Phase 1 (Single Rollout)",
      input: "Analyze this rollout.",
    });

    const upstream = requests[0] as { model?: string };
    expect(upstream.model).toBe(QWEN_3_5_9B.id);
  });
});

async function getModels(): Promise<Record<string, any>> {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/models`);
    expect(response.ok).toBe(true);
    return (await response.json()) as Record<string, any>;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

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

async function postResponsesStreamingTimeline(body: unknown): Promise<Array<{ atMs: number; text: string }>> {
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
    const startedAt = Date.now();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    expect(response.body).not.toBeNull();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const timeline: Array<{ atMs: number; text: string }> = [];
    while (true) {
      const read = await reader.read();
      if (read.done) {
        break;
      }
      timeline.push({ atMs: Date.now() - startedAt, text: decoder.decode(read.value, { stream: true }) });
    }
    const finalText = decoder.decode();
    if (finalText) {
      timeline.push({ atMs: Date.now() - startedAt, text: finalText });
    }
    return timeline;
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

function sseResponse(chunks: unknown[], options: { lineEnding?: "\n" | "\r\n" } = {}): Response {
  const lineEnding = options.lineEnding ?? "\n";
  const separator = `${lineEnding}${lineEnding}`;
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}${separator}`).join("") + `data: [DONE]${separator}`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function delayedSseResponse(chunks: Array<{ delayMs: number; chunk: unknown }>): Response {
  const encoder = new TextEncoder();
  const separator = "\n\n";
  return new Response(new ReadableStream({
    async start(controller) {
      for (const { delayMs, chunk } of chunks) {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}${separator}`));
      }
      controller.enqueue(encoder.encode(`data: [DONE]${separator}`));
      controller.close();
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function hangingSseResponse(chunks: unknown[], options: { lineEnding?: "\n" | "\r\n" } = {}): Response {
  const encoder = new TextEncoder();
  const lineEnding = options.lineEnding ?? "\n";
  const separator = `${lineEnding}${lineEnding}`;
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}${separator}`));
      }
    },
    cancel() {
      // The proxy should cancel this stream once the idle timeout fires.
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function noProgressSseResponse(): Response {
  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  return new Response(new ReadableStream({
    start(controller) {
      interval = setInterval(() => {
        controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{}}]}\n\n"));
      }, 20);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function reasoningOnlySseResponse(): Response {
  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  return new Response(new ReadableStream({
    start(controller) {
      interval = setInterval(() => {
        controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"thinking \"}}]}\n\n"));
      }, 20);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function firstToolName(requests: unknown[]): string | undefined {
  const request = requests[0] as { tools?: Array<{ function?: { name?: string } }> } | undefined;
  return request?.tools?.[0]?.function?.name;
}
