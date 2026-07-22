import http from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2, MINIMAX_M3, QWEN_3_5_9B, QWEN_3_7_MAX } from "@togetherlink/models";
import { handleCodexProxyRequest, type CodexProxyOptions } from "../../cli/src/lib/codex/proxy.js";
import { asRecord } from "./json-lines.js";

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
    expect(first?.model_messages).toEqual(
      expect.objectContaining({
        instructions_template: expect.stringContaining("{{ personality }}"),
      }),
    );
    expect(first?.apply_patch_tool_type).toBe("freeform");
    expect(first?.web_search_tool_type).toBe("text_and_image");
    expect(first?.supports_search_tool).toBe(true);
    const expectedLimit = Math.floor(GLM_5_2.limit.context / 1.8);
    expect(first?.truncation_policy).toEqual({
      mode: "tokens",
      limit: expectedLimit,
    });
    expect(first?.auto_compact_token_limit).toBe(expectedLimit);
    expect(first?.effective_context_window_percent).toBe(56);
    expect(first?.comp_hash).toBeNull();
    expect(first?.use_responses_lite).toBe(false);
  });

  test("routes chat completions through the session upstream base URL", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        urls.push(url);
        return jsonResponse({
          choices: [{ message: { content: "ROUTED" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }),
    );

    const response = await postResponses(
      {
        model: GLM_5_2.id,
        input: [{ type: "message", role: "user", content: "route me" }],
      },
      { ...options, baseUrl: "http://codex-upstream.test/together/v1" },
    );

    expect(response.status).toBe("completed");
    expect(urls).toEqual(["http://codex-upstream.test/together/v1/chat/completions"]);
  });

  test("all models compact before Together tokenizer rejects (1.8x mismatch)", async () => {
    const catalog = await getModels();
    expect(catalog.models.length).toBeGreaterThan(0);
    for (const m of catalog.models as Array<Record<string, unknown>>) {
      const ctx = m.context_window as number;
      const expectedLimit = Math.floor(ctx / 1.8);
      expect(m.auto_compact_token_limit).toBe(expectedLimit);
      expect(m.effective_context_window_percent).toBe(56);
      expect((m.truncation_policy as { limit: number }).limit).toBe(expectedLimit);
    }
  });

  test("preserves prior reasoning items when translating Codex history", async () => {
    const requests: Array<{ messages?: Array<Record<string, unknown>> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "DONE" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 20, completion_tokens: 2, total_tokens: 22 },
        });
      }),
    );

    await postResponses({
      model: GLM_5_2.id,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Start." }] },
        {
          type: "reasoning",
          content: [{ type: "reasoning_text", text: "Remember marker BLUE-CHAIR-8273." }],
        },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "READY" }],
        },
        { type: "message", role: "user", content: [{ type: "input_text", text: "Continue." }] },
      ],
    });

    expect(requests[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "READY",
          reasoning_content: "Remember marker BLUE-CHAIR-8273.",
        }),
      ]),
    );
  });

  test("returns reasoning items that normal Codex can safely replay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return jsonResponse({
          choices: [
            {
              message: {
                reasoning_content: "Private Together reasoning must not enter persisted history.",
                content: "VISIBLE_ANSWER",
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        });
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Answer." }] },
      ],
    });

    expect(response.output).toEqual([
      expect.objectContaining({
        type: "reasoning",
        summary: [],
        content: [],
      }),
      expect.objectContaining({
        type: "message",
        role: "assistant",
        content: [expect.objectContaining({ type: "output_text", text: "VISIBLE_ANSWER" })],
      }),
    ]);
  });

  test("streams reasoning live without putting it in completed history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return sseResponse([
          { choices: [{ delta: { reasoning_content: "VISIBLE_WHILE_RUNNING" } }] },
          { choices: [{ delta: { content: "PORTABLE_ANSWER" } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } },
        ]);
      }),
    );

    const raw = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Answer." }] },
      ],
    });
    const events = responsesSseEvents(raw);
    const reasoningDelta = events.find((event) => event.type === "response.reasoning_text.delta");
    const reasoningDone = events.find(
      (event) =>
        event.type === "response.output_item.done" && asRecord(event.item).type === "reasoning",
    );
    const completed = events.find((event) => event.type === "response.completed");
    const completedOutput = asRecord(completed?.response).output;

    expect(reasoningDelta?.delta).toBe("VISIBLE_WHILE_RUNNING");
    expect(asRecord(reasoningDone?.item).content).toEqual([]);
    expect(Array.isArray(completedOutput)).toBe(true);
    expect(
      asRecord(Array.isArray(completedOutput) ? completedOutput[0] : undefined).content,
    ).toEqual([]);
    expect(raw).toContain("PORTABLE_ANSWER");
  });

  test("keeps custom and function tool history portable across resumed turns", async () => {
    const requests: Array<{ messages?: Array<Record<string, unknown>> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        if (requests.length === 1) {
          return jsonResponse({
            choices: [
              {
                message: {
                  reasoning_content: "Choose two local actions.",
                  tool_calls: [
                    {
                      id: "call_patch",
                      type: "function",
                      function: {
                        name: "apply_patch",
                        arguments: JSON.stringify({ input: "*** Begin Patch\n*** End Patch" }),
                      },
                    },
                    {
                      id: "call_shell",
                      type: "function",
                      function: {
                        name: "shell",
                        arguments: JSON.stringify({ command: "cat marker.txt" }),
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
          });
        }
        return jsonResponse({
          choices: [
            {
              message: { reasoning_content: "Both actions completed.", content: "RESUMED_OK" },
              finish_reason: "stop",
            },
          ],
        });
      }),
    );

    const tools = [
      {
        type: "custom",
        name: "apply_patch",
        description: "Apply a patch.",
        format: { type: "grammar", syntax: "lark", definition: "start: /.+/" },
      },
      {
        type: "function",
        name: "shell",
        description: "Run a shell command.",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    ];
    const first = await postResponses({
      model: GLM_5_2.id,
      tools,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Act." }] }],
    });

    expect(first.output).toEqual([
      expect.objectContaining({ type: "reasoning", content: [] }),
      expect.objectContaining({
        type: "custom_tool_call",
        call_id: "call_patch",
        name: "apply_patch",
      }),
      expect.objectContaining({
        type: "function_call",
        call_id: "call_shell",
        name: "shell",
      }),
    ]);

    const second = await postResponses({
      model: GLM_5_2.id,
      tools,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Act." }] },
        ...first.output,
        { type: "custom_tool_call_output", call_id: "call_patch", output: "PATCH_DONE" },
        { type: "function_call_output", call_id: "call_shell", output: "SHELL_DONE" },
      ],
    });

    expect(requests[1]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: null,
          tool_calls: [
            expect.objectContaining({ id: "call_patch" }),
            expect.objectContaining({ id: "call_shell" }),
          ],
        }),
        { role: "tool", tool_call_id: "call_patch", content: "PATCH_DONE" },
        { role: "tool", tool_call_id: "call_shell", content: "SHELL_DONE" },
      ]),
    );
    expect(second.output).toEqual([
      expect.objectContaining({ type: "reasoning", content: [] }),
      expect.objectContaining({
        type: "message",
        role: "assistant",
        content: [expect.objectContaining({ type: "output_text", text: "RESUMED_OK" })],
      }),
    ]);
  });

  test("maps custom tool calls back to Codex custom_tool_call items", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
      }),
    );

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
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Patch it." }] },
      ],
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

  test("bridges client-executed tool search through Together function calling", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
                    id: "search-1",
                    type: "function",
                    function: {
                      name: "tool_search",
                      arguments: JSON.stringify({ query: "calendar create", limit: 1 }),
                    },
                  },
                ],
              },
            },
          ],
        });
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [
        {
          type: "tool_search",
          execution: "client",
          description: "Search deferred tools.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" }, limit: { type: "number" } },
            required: ["query"],
            additionalProperties: false,
          },
        },
      ],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Create it." }] },
      ],
    });

    expect(firstToolName(requests)).toBe("tool_search");
    expect(response.output).toEqual([
      {
        id: expect.stringMatching(/^tsc_/),
        type: "tool_search_call",
        status: "completed",
        call_id: "search-1",
        execution: "client",
        arguments: { query: "calendar create", limit: 1 },
      },
    ]);
  });

  test("loads only tools returned by Codex tool search on the continuation turn", async () => {
    const requests: Array<{
      tools?: Array<{ function?: { name?: string } }>;
      messages?: Array<Record<string, unknown>>;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
                    id: "calendar-1",
                    type: "function",
                    function: {
                      name: "calendar_create",
                      arguments: JSON.stringify({ title: "Demo" }),
                    },
                  },
                ],
              },
            },
          ],
        });
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [
        {
          type: "tool_search",
          execution: "client",
          description: "Search deferred tools.",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
        {
          type: "function",
          name: "never_selected",
          description: "A deferred tool that should stay out of context.",
          defer_loading: true,
          parameters: { type: "object", properties: {} },
        },
      ],
      input: [
        { type: "message", role: "user", content: "Create it." },
        {
          type: "tool_search_call",
          call_id: "search-1",
          execution: "client",
          arguments: { query: "calendar create", limit: 1 },
        },
        {
          type: "tool_search_output",
          call_id: "search-1",
          execution: "client",
          status: "completed",
          tools: [
            {
              type: "function",
              name: "calendar_create",
              description: "Create a calendar event.",
              defer_loading: true,
              parameters: {
                type: "object",
                properties: { title: { type: "string" } },
                required: ["title"],
              },
            },
          ],
        },
      ],
    });

    expect(requests[0]?.tools?.map((tool) => tool.function?.name)).toEqual([
      "tool_search",
      "calendar_create",
    ]);
    expect(requests[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          tool_calls: [
            expect.objectContaining({
              id: "search-1",
              function: {
                name: "tool_search",
                arguments: JSON.stringify({ query: "calendar create", limit: 1 }),
              },
            }),
          ],
        }),
        expect.objectContaining({
          role: "tool",
          tool_call_id: "search-1",
          content: "Loaded tools: calendar_create",
        }),
      ]),
    );
    expect(response.output).toEqual([
      expect.objectContaining({
        type: "function_call",
        call_id: "calendar-1",
        name: "calendar_create",
      }),
    ]);
  });

  test("flattens namespace tools for Together and restores namespace in Codex output", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
      }),
    );

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
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Use an agent." }] },
      ],
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
      }),
    );

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
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use two agents." }],
        },
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
      messages: Array<{
        role: string;
        tool_call_id?: string;
        tool_calls?: Array<{ id: string; function: { name: string } }>;
      }>;
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
              function: {
                name: "multi_agent_v1__spawn_agent",
                arguments: JSON.stringify({ task: "Say Hello." }),
              },
            },
            {
              id: "call_world",
              type: "function",
              function: {
                name: "multi_agent_v1__spawn_agent",
                arguments: JSON.stringify({ task: "Say World." }),
              },
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
                      function: { name: "multi_agent_v1__spawn_agent", arguments: '{"task":"Say ' },
                    },
                    {
                      index: 1,
                      id: "call_beta",
                      type: "function",
                      function: { name: "multi_agent_v1__spawn_agent", arguments: '{"task":"Say ' },
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
                    { index: 0, function: { arguments: 'alpha"}' } },
                    { index: 1, function: { arguments: 'beta"}' } },
                  ],
                },
              },
            ],
          },
          { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        ]);
      }),
    );

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
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use two agents." }],
        },
      ],
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

  test("streams tool search as a completed client-executed Codex item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
                      id: "search-stream-1",
                      type: "function",
                      function: {
                        name: "tool_search",
                        arguments: '{"query":"calendar create","limit":1}',
                      },
                    },
                  ],
                },
              },
            ],
          },
          { choices: [{ finish_reason: "tool_calls", delta: {} }] },
        ]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [
        {
          type: "tool_search",
          execution: "client",
          description: "Search deferred tools.",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
      ],
      input: [{ type: "message", role: "user", content: "Create an event." }],
    });

    expect(response).toContain('"type":"tool_search_call"');
    expect(response).toContain('"call_id":"search-stream-1"');
    expect(response).toContain('"execution":"client"');
    expect(response).toContain('"arguments":{"query":"calendar create","limit":1}');
    expect(response).toContain("response.completed");
  });

  test("parses CRLF-delimited upstream SSE streams", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return sseResponse(
          [
            { choices: [{ delta: { content: "hi" } }] },
            { choices: [{ finish_reason: "stop", delta: {} }] },
          ],
          { lineEnding: "\r\n" },
        );
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(response).toContain("response.output_text.delta");
    expect(response).toContain("hi");
    expect(response).toContain("response.completed");
  });

  test("streams ordinary Codex turns upstream by default", async () => {
    const requests: Array<{ body: any }> = [];
    vi.unstubAllEnvs();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push({ body: JSON.parse(String(init?.body)) });
        return sseResponse([
          { choices: [{ delta: { content: "hi" } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } },
        ]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(requests[0]?.body.stream).toBe(true);
    expect(response).toContain("response.output_text.delta");
    expect(response).toContain('"sequence_number":');
    expect(response).toContain("response.content_part.done");
    expect(response).toContain("response.completed");
  });

  test("fails a streamed Codex turn when DONE arrives without a finish reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return sseResponse([{ choices: [{ delta: { content: "partial output" } }] }]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(response).toContain("response.failed");
    expect(response).toContain("without a finish reason");
    expect(response).not.toContain("response.completed");
  });

  test("retries streamed Codex turns when upstream SSE goes idle before output", async () => {
    const requests: Array<{ body: any }> = [];
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push({ body: JSON.parse(String(init?.body)) });
        if (requests.length === 1) {
          return hangingSseResponse([]);
        }
        return sseResponse([
          { choices: [{ delta: { content: "recovered" } }] },
          { choices: [{ finish_reason: "stop", delta: {} }] },
          { usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } },
        ]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(requests).toHaveLength(2);
    expect(response).toContain("response.output_text.delta");
    expect(response).toContain("recovered");
    expect(response).toContain("response.completed");
    expect(response).not.toContain("response.failed");
  });

  test("retries streamed Codex turns when Together never returns response headers", async () => {
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_STREAM_RETRIES", "1");
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    let upstreamCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        upstreamCalls += 1;
        if (upstreamCalls === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
              once: true,
            });
          });
        }
        return Promise.resolve(
          sseResponse([
            { choices: [{ delta: { content: "recovered after header timeout" } }] },
            { choices: [{ finish_reason: "stop", delta: {} }] },
          ]),
        );
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(upstreamCalls).toBe(2);
    expect(response).toContain("recovered after header timeout");
    expect(response).toContain("response.completed");
    expect(response).not.toContain("response.failed");
  });

  test("retries transient Together rate limits before returning a Codex response", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        if (requests.length === 1) {
          return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "0" },
          });
        }
        return jsonResponse({
          choices: [{ message: { content: "Recovered after retry." } }],
          usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
        });
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(requests).toHaveLength(2);
    expect(response.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Recovered after retry.", annotations: [] }],
    });
  });

  test("forwards streamed Codex deltas before the response completes", async () => {
    vi.unstubAllEnvs();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return delayedSseResponse([
          { delayMs: 0, chunk: { choices: [{ delta: { content: "hel" } }] } },
          { delayMs: 80, chunk: { choices: [{ delta: { content: "lo" } }] } },
          { delayMs: 80, chunk: { choices: [{ finish_reason: "stop", delta: {} }] } },
          {
            delayMs: 80,
            chunk: { usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } },
          },
        ]);
      }),
    );

    const timeline = await postResponsesStreamingTimeline({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hello." }] },
      ],
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
      }),
    );

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
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use six agents." }],
        },
        ...calls,
        ...outputs,
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{
        role: string;
        tool_call_id?: string;
        tool_calls?: Array<{ id: string; function: { name: string } }>;
      }>;
    };
    const assistantToolGroup = upstream.messages.find(
      (message) => message.role === "assistant" && message.tool_calls,
    );
    expect(assistantToolGroup?.tool_calls).toHaveLength(6);
    expect(assistantToolGroup?.tool_calls?.map((toolCall) => toolCall.id)).toEqual([
      "call_a",
      "call_b",
      "call_c",
      "call_d",
      "call_e",
      "call_f",
    ]);
    expect(
      assistantToolGroup?.tool_calls?.every(
        (toolCall) => toolCall.function.name === "multi_agent_v1__spawn_agent",
      ),
    ).toBe(true);
    expect(
      upstream.messages
        .filter((message) => message.role === "tool")
        .map((message) => message.tool_call_id),
    ).toEqual(["call_a", "call_b", "call_c", "call_d", "call_e", "call_f"]);
  });

  test("runs web_search internally with Exa and returns the final assistant answer", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ url, body });
        if (url.includes("api.exa.ai")) {
          return jsonResponse({
            results: [
              {
                title: "Codex docs",
                url: "https://developers.openai.com/codex",
                text: "Codex helps with coding.",
              },
            ],
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
                      function: {
                        name: "web_search",
                        arguments: JSON.stringify({ query: "Codex docs" }),
                      },
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
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Search Codex docs." }],
        },
      ],
    });

    expect(requests.some((request) => request.url.includes("api.exa.ai/search"))).toBe(true);
    expect(response.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "Codex docs: https://developers.openai.com/codex",
          annotations: [],
        },
      ],
    });
  });

  test("streams native web_search thinking and final answer deltas instead of buffering", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ url, body });
        if (url.includes("api.exa.ai")) {
          return jsonResponse({
            results: [
              {
                title: "Codex docs",
                url: "https://developers.openai.com/codex",
                text: "Codex helps with coding.",
              },
            ],
          });
        }
        const togetherRequestCount = requests.filter((request) =>
          request.url.includes("api.together.ai"),
        ).length;
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
                        function: {
                          name: "web_search",
                          arguments: JSON.stringify({ query: "Codex docs" }),
                        },
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
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Search Codex docs." }],
        },
      ],
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
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ url, body });
        if (url.includes("api.exa.ai")) {
          return jsonResponse({
            results: [
              {
                title: "Codex docs",
                url: "https://developers.openai.com/codex",
                text: "Codex helps with coding.",
              },
            ],
          });
        }
        return hangingSseResponse([{ choices: [{ delta: {} }] }]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream produced no SSE event for 100ms.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(2);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("fails when upstream SSE keepalives make no Codex progress", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_IDLE_RETRIES", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push({ url, body: JSON.parse(String(init?.body)) });
        return noProgressSseResponse();
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream produced no SSE event for 100ms.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(2);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("fails when native stream emits reasoning but never final output", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("TOGETHERLINK_CODEX_STREAM_TURN_TIMEOUT_MS", "100");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push({ url, body: JSON.parse(String(init?.body)) });
        return reasoningOnlySseResponse();
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [{ type: "web_search", name: "web_search" }],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Say hi." }] },
      ],
    });

    expect(response).toContain("response.reasoning_text.delta");
    expect(response).toContain("response.failed");
    expect(response).toContain("Together stream exceeded maximum turn duration of 100ms.");
    expect(response).not.toContain("Recovered after reasoning timeout.");
    expect(response).not.toContain("response.completed");
    expect(requests.filter((request) => request.url.includes("api.together.ai"))).toHaveLength(1);
    expect(requests[0]?.body.stream).toBe(true);
  });

  test("does not leak native web_search when a client tool call is returned in the same group", async () => {
    const requests: Array<{ url: string; body: any }> = [];
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ url, body });
        if (url.includes("api.exa.ai")) {
          return jsonResponse({
            results: [
              {
                title: "Codex docs",
                url: "https://developers.openai.com/codex",
                text: "Codex helps with coding.",
              },
            ],
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
                    function: {
                      name: "web_search",
                      arguments: JSON.stringify({ query: "Codex docs" }),
                    },
                  },
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
        });
      }),
    );

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
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Search and patch." }],
        },
      ],
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
            text: expect.stringContaining('Web search results for "Codex docs" via Exa'),
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "I can see the image." } }],
        });
      }),
    );

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return sseResponse([
          { choices: [{ delta: { content: "I can see the image." }, finish_reason: "stop" }] },
        ]);
      }),
    );

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
        });
      }),
    );

    await postResponses({
      model: GLM_5_2.id,
      tool_choice: { type: "function", name: "spawn_agent" },
      tools: [
        {
          type: "namespace",
          name: "multi_agent_v1",
          tools: [
            {
              type: "function",
              name: "spawn_agent",
              parameters: { type: "object", properties: {} },
            },
          ],
        },
      ],
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Use the agent." }],
        },
      ],
    });

    const upstream = requests[0] as { tool_choice?: unknown };
    expect(upstream.tool_choice).toEqual({
      type: "function",
      function: { name: "multi_agent_v1__spawn_agent" },
    });
  });

  test("maps Together reasoning token usage into Responses usage details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
      }),
    );

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

  test("defaults max_tokens to the model output budget when Codex omits max_output_tokens", async () => {
    const requests: Array<Record<string, any>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        });
      }),
    );

    await postResponses({
      model: GLM_5_2.id,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hi." }] }],
    });

    // Together silently caps omitted max_tokens at 2048, which truncates
    // long-reasoning models (Kimi K2.6/K2.7) mid-turn; the proxy must always
    // send an explicit budget. A tiny input leaves the full output limit free.
    expect(requests[0]?.max_tokens).toBe(GLM_5_2.limit.output);

    await postResponses({
      model: GLM_5_2.id,
      max_output_tokens: 1234,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hi." }] }],
    });

    expect(requests[1]?.max_tokens).toBe(1234);
  });

  test("routes Codex memory extraction requests to the default long-context Together model", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
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
                  raw_memory:
                    "TogetherLink should route Codex memory extraction separately from the main coding model.",
                }),
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
        });
      }),
    );

    const response = await postResponses({
      model: "gpt-5.4-mini",
      instructions:
        "## Memory Writing Agent: Phase 1 (Single Rollout)\n\nYou are a Memory Writing Agent.",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Analyze this rollout." }],
        },
      ],
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse({ choices: [{ message: { content: "{}" } }] });
      }),
    );

    await postResponses({
      model: "gpt-5.4-mini",
      instructions: "## Memory Writing Agent: Phase 1 (Single Rollout)",
      input: "Analyze this rollout.",
    });

    const upstream = requests[0] as { model?: string };
    expect(upstream.model).toBe(QWEN_3_5_9B.id);
  });

  test("renames top-level `items` key in tool-call arguments for all models", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return sseResponse([{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }]);
      }),
    );

    await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [
        {
          type: "function",
          name: "spawn_agent",
          description: "Start a sub-agent.",
          parameters: { type: "object", properties: {} },
        },
      ],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Go." }] },
        {
          type: "function_call",
          name: "spawn_agent",
          call_id: "call_items",
          arguments: JSON.stringify({
            items: [{ type: "text", text: "analyze the screenshot" }],
            message: "Analyze the attached screenshot",
          }),
        },
        {
          type: "function_call_output",
          call_id: "call_items",
          output: "done",
        },
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{
        role: string;
        tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }>;
      }>;
    };
    const assistantCall = upstream.messages.find(
      (m) => m.role === "assistant" && m.tool_calls?.some((c) => c.id === undefined || true),
    );
    const toolCall = assistantCall?.tool_calls?.[0];
    expect(toolCall?.function.name).toBe("spawn_agent");
    // The dangerous top-level `items` key must be renamed to `_items`.
    const parsedArgs = JSON.parse(toolCall?.function.arguments ?? "{}");
    expect(parsedArgs).not.toHaveProperty("items");
    expect(parsedArgs).toHaveProperty("_items");
    expect(parsedArgs._items).toEqual([{ type: "text", text: "analyze the screenshot" }]);
    // Non-colliding keys are preserved untouched.
    expect(parsedArgs.message).toBe("Analyze the attached screenshot");
  });

  test("also renames `items` key for non-GLM models (global defense, not per-model)", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        requests.push(JSON.parse(String(init?.body)));
        return sseResponse([{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }]);
      }),
    );

    await postResponsesText({
      model: QWEN_3_7_MAX.id,
      stream: true,
      tools: [
        {
          type: "function",
          name: "spawn_agent",
          description: "Start a sub-agent.",
          parameters: { type: "object", properties: {} },
        },
      ],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Go." }] },
        {
          type: "function_call",
          name: "spawn_agent",
          call_id: "call_items",
          arguments: JSON.stringify({
            items: [{ type: "text", text: "analyze the screenshot" }],
            message: "Analyze the attached screenshot",
          }),
        },
        {
          type: "function_call_output",
          call_id: "call_items",
          output: "done",
        },
      ],
    });

    const upstream = requests[0] as {
      messages: Array<{
        role: string;
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      }>;
    };
    const assistantCall = upstream.messages.find((m) => m.role === "assistant");
    const toolCall = assistantCall?.tool_calls?.[0];
    expect(toolCall?.function.name).toBe("spawn_agent");
    // Non-GLM models are defended too: the rename is global, not per-model,
    // so a stale allowlist can never silently leave a model unprotected.
    const parsedArgs = JSON.parse(toolCall?.function.arguments ?? "{}");
    expect(parsedArgs).not.toHaveProperty("items");
    expect(parsedArgs).toHaveProperty("_items");
    expect(parsedArgs._items).toEqual([{ type: "text", text: "analyze the screenshot" }]);
  });

  test("self-heals template-error 400 by sanitizing dict-method keys and retrying", async () => {
    const requests: Array<{ body: any }> = [];
    let togetherCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ body });
        togetherCallCount += 1;
        if (togetherCallCount === 1) {
          // Simulate a Together template-error 400 (e.g. a `keys` collision
          // on a model whose template calls arguments.keys()).
          return new Response(
            JSON.stringify({
              error: {
                message: {
                  type: "Bad Request",
                  code: "process_messages_failed",
                  message:
                    "Failed to apply chat template: invalid operation: object is not callable (in chat:85)",
                },
              },
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }
        // Retry after sanitization: succeed.
        return sseResponse([{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      tools: [
        {
          type: "function",
          name: "my_tool",
          description: "A tool.",
          parameters: { type: "object", properties: {} },
        },
      ],
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Go." }] },
        {
          type: "function_call",
          name: "my_tool",
          call_id: "call_keys",
          // `keys` is a dict method the proactive sanitizer does NOT rename
          // (only `items` is proactively renamed), so it reaches Together
          // unmodified and triggers the reactive self-healing path.
          arguments: JSON.stringify({ keys: ["a", "b"], task: "do something" }),
        },
        { type: "function_call_output", call_id: "call_keys", output: "done" },
      ],
    });

    // Two upstream calls: first failed, retry after sanitization succeeded.
    expect(togetherCallCount).toBe(2);

    // The retry payload must have `keys` renamed to `_keys`.
    const retryPayload = requests[1]?.body;
    const assistantMsg = retryPayload?.messages?.find(
      (m: any) => m.role === "assistant" && m.tool_calls,
    );
    const toolCall = assistantMsg?.tool_calls?.[0];
    const parsedArgs = JSON.parse(toolCall?.function?.arguments ?? "{}");
    expect(parsedArgs).not.toHaveProperty("keys");
    expect(parsedArgs).toHaveProperty("_keys");
    expect(parsedArgs._keys).toEqual(["a", "b"]);
    // Non-colliding keys are preserved.
    expect(parsedArgs.task).toBe("do something");

    // The self-healing retry should produce a completed response, not a failure.
    expect(response).toContain("response.completed");
    expect(response).not.toContain("response.failed");
  });

  test("emits response.incomplete when upstream finish_reason is length (streaming)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        // Model says "I'll do this and then" — hits max_tokens after a few
        // tokens. finish_reason "length" means the turn was TRUNCATED, not
        // completed. The proxy must NOT silently emit status "completed".
        return sseResponse([
          { choices: [{ delta: { content: "I'll do this and then" } }] },
          { choices: [{ finish_reason: "length", delta: {} }] },
          { usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 } },
        ]);
      }),
    );

    const response = await postResponsesText({
      model: GLM_5_2.id,
      stream: true,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Do a lot." }] },
      ],
    });

    // The turn was truncated by max_tokens — Codex must see "incomplete".
    // Parse the response.completed event JSON and check the top-level status.
    // (Individual output items have their own item-level "completed" status —
    // we only care about the response.status field, not string-matching.)
    const completedLine = response
      .split("\n")
      .find((l) => l.startsWith("data: ") && l.includes('"response.completed"'));
    expect(completedLine).toBeDefined();
    const completedData = JSON.parse(completedLine!.replace(/^data: /, ""));
    expect(completedData.response.status).toBe("incomplete");
    expect(completedData.response.incomplete_details).toEqual({
      reason: "max_output_tokens",
    });
  });

  test("returns status incomplete when upstream finish_reason is length (non-streaming)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        return jsonResponse({
          choices: [{ message: { content: "I'll do this and" }, finish_reason: "length" }],
          usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 },
        });
      }),
    );

    const response = await postResponses({
      model: GLM_5_2.id,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "Do a lot." }] },
      ],
    });

    expect(response.status).toBe("incomplete");
    expect(response.incomplete_details).toEqual({ reason: "max_output_tokens" });
  });

  test("trims old context and retries when input alone exceeds the context window", async () => {
    const requests: Array<{ body: any }> = [];
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("http://127.0.0.1:")) {
          return realFetch(url, init);
        }
        const body = JSON.parse(String(init?.body));
        requests.push({ body });
        callCount += 1;
        if (callCount === 1) {
          // Together rejects: input alone (325k) exceeds the 262k window.
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "This model's maximum context length is 262,144 tokens. (325,611 input tokens, 0 output tokens).",
              },
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }
        // After trim, succeed.
        return jsonResponse({
          choices: [{ message: { content: "Done after trim." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 200, completion_tokens: 5, total_tokens: 205 },
        });
      }),
    );

    const longText = "x".repeat(200_000);
    const longReply = "y".repeat(200_000);
    const response = await postResponses({
      model: GLM_5_2.id,
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: longText }] },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: longReply }],
        },
        { type: "message", role: "user", content: [{ type: "input_text", text: "Continue." }] },
      ],
    });

    // Two upstream calls: first 400, retry after input trim succeeded.
    expect(callCount).toBe(2);
    expect(response.status).toBe("completed");
    expect(response.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Done after trim.", annotations: [] }],
    });
    // The retry payload must have trimmed old context (trim marker inserted).
    const retryMessages = requests[1]?.body?.messages;
    expect(retryMessages).toBeDefined();
    const hasTrimMarker = retryMessages.some(
      (m: any) => typeof m.content === "string" && m.content.includes("[togetherlink trimmed"),
    );
    expect(hasTrimMarker).toBe(true);
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

async function postResponses(
  body: unknown,
  proxyOptions: CodexProxyOptions = options,
): Promise<Record<string, any>> {
  const server = http.createServer((req, res) => {
    handleCodexProxyRequest(req, res, proxyOptions).catch((error) => {
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

async function postResponsesStreamingTimeline(
  body: unknown,
): Promise<Array<{ atMs: number; text: string }>> {
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
      timeline.push({
        atMs: Date.now() - startedAt,
        text: decoder.decode(read.value, { stream: true }),
      });
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
  const body =
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}${separator}`).join("") +
    `data: [DONE]${separator}`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function delayedSseResponse(chunks: Array<{ delayMs: number; chunk: unknown }>): Response {
  const encoder = new TextEncoder();
  const separator = "\n\n";
  return new Response(
    new ReadableStream({
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
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function hangingSseResponse(
  chunks: unknown[],
  options: { lineEnding?: "\n" | "\r\n" } = {},
): Response {
  const encoder = new TextEncoder();
  const lineEnding = options.lineEnding ?? "\n";
  const separator = `${lineEnding}${lineEnding}`;
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}${separator}`));
        }
      },
      cancel() {
        // The proxy should cancel this stream once the idle timeout fires.
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function noProgressSseResponse(): Response {
  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  return new Response(
    new ReadableStream({
      start(controller) {
        interval = setInterval(() => {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{}}]}\n\n'));
        }, 20);
      },
      cancel() {
        if (interval) {
          clearInterval(interval);
        }
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function reasoningOnlySseResponse(): Response {
  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;
  return new Response(
    new ReadableStream({
      start(controller) {
        interval = setInterval(() => {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"thinking "}}]}\n\n'),
          );
        }, 20);
      },
      cancel() {
        if (interval) {
          clearInterval(interval);
        }
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function responsesSseEvents(raw: string): Array<Record<string, unknown>> {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => asRecord(JSON.parse(line.slice("data: ".length))));
}

function firstToolName(requests: unknown[]): string | undefined {
  const request = requests[0] as { tools?: Array<{ function?: { name?: string } }> } | undefined;
  return request?.tools?.[0]?.function?.name;
}
