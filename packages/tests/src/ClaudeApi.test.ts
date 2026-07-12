import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2, type ModelDefinition } from "../../models/src/index.js";
import { buildClaudeEnv } from "../../cli/src/lib/claude/core.js";
import { isClaudeCompactionRequest } from "../../cli/src/lib/claude/compaction.js";
import { CLAUDE_HAIKU_MODEL } from "../../cli/src/lib/claude/defaults.js";
import { handleProxyRequest } from "../../cli/src/lib/claude/proxy.js";
import type { ClaudeProxyOptions } from "../../cli/src/lib/claude/proxy.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const EXPECTED_HAIKU_MODEL_ID = CLAUDE_HAIKU_MODEL.anthropicAlias ?? CLAUDE_HAIKU_MODEL.id;

describe("Claude proxy compatibility API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("returns metadata for a supported model id", async () => {
    const response = await callClaudeProxy({
      method: "GET",
      url: `/v1/models/${encodeURIComponent(GLM_5_2.id)}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(GLM_5_2.anthropicAlias);
    expect(response.body.max_input_tokens).toBeLessThan(GLM_5_2.limit.context);
    expect(response.body.max_tokens).toBe(GLM_5_2.limit.output);
  });

  test("configures Claude Code's Haiku tier to a lightweight Together model", () => {
    const previous = process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
    delete process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
    try {
      const env = buildClaudeEnv({
        apiKey: "test-together-key",
        modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
        modelName: GLM_5_2.name,
        proxyUrl: "http://127.0.0.1:7878/session/test",
        authToken: "local-token",
      });

      expect(env.ANTHROPIC_MODEL).toBe(GLM_5_2.anthropicAlias);
      expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(EXPECTED_HAIKU_MODEL_ID);
      expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).not.toBe(GLM_5_2.anthropicAlias);
      expect(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("32000");
    } finally {
      if (previous === undefined) {
        delete process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
      } else {
        process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = previous;
      }
    }
  });

  test("preserves a user-provided Claude Code max output token setting", () => {
    vi.stubEnv("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "24000");

    const env = buildClaudeEnv({
      apiKey: "test-together-key",
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      modelName: GLM_5_2.name,
      proxyUrl: "http://127.0.0.1:7878/session/test",
      authToken: "local-token",
    });

    expect(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("24000");
  });

  test("counts tokens without calling the upstream model", async () => {
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages/count_tokens",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        messages: [{ role: "user", content: "Hello, world" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.input_tokens).toBe("number");
    expect(response.body.input_tokens).toBeGreaterThan(0);
  });

  test("count_tokens does not hide prompts that exceed the advertised safe input limit", async () => {
    const hugePrompt = "oversized context ".repeat(70_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages/count_tokens",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        messages: [{ role: "user", content: hugePrompt }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.input_tokens).toBeGreaterThan(GLM_5_2.limit.context - 4096);
  });

  test("trims Claude compaction-sized input before sacrificing the summary budget", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        // The trim path now fires an always-on context_trim telemetry event
        // (TURN.md 1e) which also routes through global fetch. Skip it so this
        // stub only captures the upstream Together request bodies under test.
        if (typeof _url === "string" && _url.includes("/api/telemetry")) {
          return new Response(null, { status: 204 });
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_budgeted",
            choices: [{ message: { content: "BUDGETED_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 259_000, completion_tokens: 1, total_tokens: 259_001 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const nearFullContext = "context budget pressure ".repeat(44_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        messages: [{ role: "user", content: nearFullContext }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "BUDGETED_OK" }]);
    expect(upstreamBodies).toHaveLength(1);
    const upstreamContent = firstUserContent(upstreamBodies[0]);
    expect(typeof upstreamContent).toBe("string");
    if (typeof upstreamContent !== "string") {
      throw new Error("expected upstream user content to be a string");
    }
    expect(upstreamContent).toContain(
      "[togetherlink trimmed older context to fit the model window]",
    );
    expect(upstreamContent.length).toBeLessThan(nearFullContext.length);
    expect(upstreamBodies[0]?.max_tokens).toBeLessThanOrEqual(28_000);
    expect(upstreamBodies[0]?.max_tokens).toBeGreaterThanOrEqual(16_000);
  });

  test("does not clamp output to one token after resolving large image history", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if (body.model !== GLM_5_2.id) {
          return new Response(
            JSON.stringify({
              id: "chatcmpl_vision",
              choices: [
                {
                  message: { content: "Resolved screenshot: compact terminal description." },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 12, total_tokens: 112 },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        upstreamBodies.push(body);
        return sseResponse([
          {
            choices: [{ delta: { content: "IMAGE_BUDGET_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 160_000, completion_tokens: 4, total_tokens: 160_004 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 32_000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Continue after this screenshot." },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: "A".repeat(1_100_000),
                },
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("IMAGE_BUDGET_OK");
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.max_tokens).toBe(28_000);
    expect(String(firstUserContent(upstreamBodies[0]))).toContain(
      "Resolved screenshot: compact terminal description.",
    );
  });

  test("tunes Claude Code compaction output before forwarding to Together", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_compact",
            choices: [
              { message: { content: "<summary>COMPACT_OK</summary>" }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        messages: [{ role: "user", content: claudeCompactionPrompt("prior turn") }],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.max_tokens).toBe(32_000);
    const upstreamContent = String(firstUserContent(upstreamBodies[0]));
    expect(upstreamContent).toContain("Togetherlink bounded compaction request");
    expect(upstreamContent).not.toContain("include full code snippets");
    expect(upstreamContent).not.toContain("List ALL user messages");
  });

  test("detects Claude Code full, recent, and continuing-session compaction variants", () => {
    for (const task of [
      "Your task is to create a detailed summary of the conversation so far",
      "Your task is to create a detailed summary of the RECENT portion of the conversation",
      "Your task is to create a detailed summary of this conversation",
    ]) {
      expect(
        isClaudeCompactionRequest({
          model: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
          max_tokens: 32_000,
          messages: [
            {
              role: "user",
              content: `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.\nYour entire response must be plain text: an <analysis> block followed by a <summary> block.\n${task}`,
            },
          ],
        }),
      ).toBe(true);
    }
  });

  test("finishes streamed compaction without triggering Claude Code continuation", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return sseResponse([
          {
            choices: [
              {
                // GLM may return summarization output in reasoning_content even
                // when reasoning is disabled. Compaction must expose it as
                // assistant text or Claude Code rejects the response entirely.
                delta: {
                  reasoning_content: "<analysis>brief</analysis><summary>bounded handoff</summary>",
                },
                finish_reason: "length",
              },
            ],
            usage: { prompt_tokens: 250_000, completion_tokens: 8_000, total_tokens: 258_000 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000, effort: "max" },
        messages: [{ role: "user", content: claudeCompactionPrompt("prior turn") }],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      max_tokens: 32_000,
      reasoning: { enabled: false },
      chat_template_kwargs: { clear_thinking: true },
    });
    expect(upstreamBodies[0]?.reasoning_effort).toBeUndefined();
    expect(response.body).toContain("bounded handoff");
    expect(response.body).toContain('"type":"text_delta"');
    expect(response.body).not.toContain('"type":"thinking_delta"');
    expect(response.body).toContain('"stop_reason":"end_turn"');
    expect(response.body).not.toContain('"stop_reason":"max_tokens"');
  });

  test("honors user-configured Claude Code max output tokens during compaction", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_compact_user_budget",
            choices: [
              { message: { content: "<summary>USER_BUDGET_OK</summary>" }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 24_000,
        messages: [{ role: "user", content: claudeCompactionPrompt("prior turn") }],
      }),
      options: {
        claudeCodeMaxOutputTokens: 24_000,
        claudeCodeMaxOutputTokensUserSet: true,
      },
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.max_tokens).toBe(24_000);
    expect(String(firstUserContent(upstreamBodies[0]))).toContain(
      "The user configured CLAUDE_CODE_MAX_OUTPUT_TOKENS",
    );
  });

  test("uses compact thinking signatures instead of echoing full reasoning", async () => {
    const longReasoning = "reasoning trace ".repeat(10_000);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl_reasoning_signature",
            choices: [
              {
                message: { reasoning: longReasoning, content: "SIGNATURE_OK" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10_000, total_tokens: 10_010 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000 },
        messages: [{ role: "user", content: "Think briefly." }],
      }),
    });

    expect(response.status).toBe(200);
    const content = response.body.content as Array<Record<string, unknown>>;
    expect(content[0]?.type).toBe("thinking");
    expect(content[0]?.thinking).toBe(longReasoning);
    expect(String(content[0]?.signature)).toMatch(/^togetherlink:[a-f0-9]{16}$/);
    expect(String(content[0]?.signature).length).toBeLessThan(40);
  });

  test("preserves prior Claude thinking blocks when translating history", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_preserved_thinking",
            choices: [{ message: { content: "DONE" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 20, completion_tokens: 2, total_tokens: 22 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [
          { role: "user", content: "Start." },
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Remember marker BLUE-CHAIR-8273.",
                signature: "togetherlink:test",
              },
              { type: "text", text: "READY" },
            ],
          },
          { role: "user", content: "Continue." },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamMessages(upstreamBodies[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "READY",
          reasoning_content: "Remember marker BLUE-CHAIR-8273.",
        }),
      ]),
    );
  });

  test("recovers from Together input-over-context errors by trimming old prompt text", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        // The reactive trim path now fires a context_trim telemetry event
        // (TURN.md 1e) which also routes through global fetch. Skip it so this
        // stub only captures the upstream Together request bodies under test.
        if (typeof _url === "string" && _url.includes("/api/telemetry")) {
          return new Response(null, { status: 204 });
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        if (upstreamBodies.length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "This model's maximum context length is 262144 tokens, but the request resolved to 262323 input tokens (including image/vision expansion). Reduce the input length, image resolution, or the number of images.",
              },
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify({
            id: "chatcmpl_trimmed",
            choices: [{ message: { content: "TRIMMED_CONTEXT_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 262000, completion_tokens: 3, total_tokens: 262003 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const oldContext = "old context ".repeat(20_000);
    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 1024,
        messages: [
          { role: "user", content: oldContext },
          { role: "user", content: "Please answer with TRIMMED_CONTEXT_OK." },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "TRIMMED_CONTEXT_OK" }]);
    expect(upstreamBodies).toHaveLength(2);
    const firstContent = firstUserContent(upstreamBodies[0]);
    const secondContent = firstUserContent(upstreamBodies[1]);
    expect(typeof firstContent).toBe("string");
    expect(typeof secondContent).toBe("string");
    if (typeof firstContent !== "string" || typeof secondContent !== "string") {
      throw new Error("expected upstream user content to be strings");
    }
    expect(secondContent.length).toBeLessThan(firstContent.length);
    expect(secondContent).toContain("[togetherlink trimmed older context to fit the model window]");
  });

  test("routes Claude Code Haiku-tier model requests without proxy subagent inference", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return sseResponse([
          {
            choices: [{ delta: { content: "EXPLORE_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 100, completion_tokens: 3, total_tokens: 103 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: EXPECTED_HAIKU_MODEL_ID,
        stream: true,
        max_tokens: 64_000,
        thinking: { type: "enabled", budget_tokens: 64_000 },
        system: "You are Claude Code. You are a file search specialist for Claude Code.",
        messages: [{ role: "user", content: "Find the relevant files." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("EXPLORE_OK");
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: CLAUDE_HAIKU_MODEL.id,
      max_tokens: Math.min(64_000, CLAUDE_HAIKU_MODEL.limit.output, 28_000),
      chat_template_kwargs: { clear_thinking: false },
      stream: true,
    });
    expect(upstreamBodies[0]?.reasoning_effort).toBeUndefined();
  });

  test("coalesces Claude title-generation system prompts for Haiku-tier requests", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return sseResponse([
          {
            choices: [
              { delta: { content: '{"title":"Debug title generation"}' }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 80, completion_tokens: 8, total_tokens: 88 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: EXPECTED_HAIKU_MODEL_ID,
        stream: true,
        max_tokens: 32_000,
        system:
          "You are a Claude agent, built on Anthropic's Claude Agent SDK. Generate a concise, sentence-case title. Return JSON with a single title field.",
        messages: [{ role: "user", content: "<session>Debug Qwen title generation</session>" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    const messages = upstreamMessages(upstreamBodies[0]);
    expect(messages.filter((message) => message.role === "system")).toHaveLength(1);
    expect(messages[0]?.content).toContain("Together AI model routed through togetherlink");
    expect(messages[0]?.content).toContain("Generate a concise, sentence-case title");
    expect(upstreamBodies[0]).toMatchObject({
      model: CLAUDE_HAIKU_MODEL.id,
      stream: true,
    });
  });

  test("does not escalate Claude Code thinking budget into max GLM reasoning", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_normal",
            choices: [{ message: { content: "NORMAL_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 64_000,
        thinking: { type: "enabled", budget_tokens: 64_000 },
        messages: [{ role: "user", content: "Think carefully." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body.content).toEqual([{ type: "text", text: "NORMAL_OK" }]);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: GLM_5_2.id,
      max_tokens: 28_000,
      chat_template_kwargs: { clear_thinking: false },
      stream: false,
    });
    expect(upstreamBodies[0]?.reasoning_effort).toBeUndefined();
  });

  test("keeps explicit GLM reasoning effort requests", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_explicit_reasoning",
            choices: [{ message: { content: "EXPLICIT_REASONING_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        effort: "xhigh",
        messages: [{ role: "user", content: "Use explicit high reasoning." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: GLM_5_2.id,
      max_tokens: 28_000,
      reasoning_effort: "max",
      stream: false,
    });
  });

  test("caps streamed normal Claude requests before forwarding to Together", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return sseResponse([
          {
            choices: [{ delta: { content: "STREAM_BUDGET_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000 },
        messages: [{ role: "user", content: "Continue the task." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("STREAM_BUDGET_OK");
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]).toMatchObject({
      model: GLM_5_2.id,
      max_tokens: 28_000,
      stream: true,
    });
    expect(upstreamBodies[0]?.reasoning_effort).toBeUndefined();
  });

  test("does not report short Together length stops as Claude Code max_tokens overflow", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return sseResponse([
          {
            choices: [
              {
                delta: { reasoning_content: "Useful partial reasoning before a tool decision." },
                finish_reason: "length",
              },
            ],
            usage: { prompt_tokens: 179_000, completion_tokens: 512, total_tokens: 179_512 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000 },
        messages: [{ role: "user", content: "Continue the task." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies[0]?.max_tokens).toBe(28_000);
    expect(response.body).toContain('"stop_reason":"end_turn"');
    expect(response.body).not.toContain('"stop_reason":"max_tokens"');
  });

  test("caps streamed reasoning before it can exceed Claude Code's response guard", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    const hugeReasoning = `${"R".repeat(120_000)}TAIL_SHOULD_NOT_STREAM`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return sseResponse([
          {
            choices: [{ delta: { reasoning_content: hugeReasoning }, finish_reason: null }],
          },
          {
            choices: [{ delta: { content: "VISIBLE_AFTER_REASONING" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 32_000, total_tokens: 32_010 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        stream: true,
        max_tokens: 32_000,
        thinking: { type: "enabled", budget_tokens: 32_000 },
        messages: [{ role: "user", content: "Think, then answer." }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("VISIBLE_AFTER_REASONING");
    expect(response.body).not.toContain("TAIL_SHOULD_NOT_STREAM");
    expect(response.body.length).toBeLessThan(80_000);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.max_tokens).toBe(28_000);
  });

  test("honors user-configured Claude Code max output tokens on normal turns", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstreamBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_user_normal_budget",
            choices: [{ message: { content: "USER_NORMAL_BUDGET_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 32_000,
        messages: [{ role: "user", content: "Use the configured budget." }],
      }),
      options: {
        claudeCodeMaxOutputTokens: 16_000,
        claudeCodeMaxOutputTokensUserSet: true,
      },
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamBodies[0]?.max_tokens).toBe(16_000);
  });

  test("does not treat a custom tool named web_search as native server search", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_custom_web_search",
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  tool_calls: [
                    {
                      id: "call_custom_search",
                      function: { name: "web_search", arguments: '{"query":"local"}' },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 20, completion_tokens: 4, total_tokens: 24 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [{ role: "user", content: "Call my search tool." }],
        tools: [
          {
            name: "web_search",
            description: "A client-owned search tool.",
            input_schema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamBodies).toHaveLength(1);
    expect(upstreamToolNames(upstreamBodies[0])).toEqual(["web_search"]);
    expect(response.body.content).toEqual([
      {
        type: "tool_use",
        id: "call_custom_search",
        name: "web_search",
        input: { query: "local" },
      },
    ]);
  });

  test("normalizes native web search and drops colliding custom web_search tools", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_native_collision",
            choices: [{ message: { content: "COLLISION_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [{ role: "user", content: "Search if needed." }],
        tools: [
          { type: "web_search_20250305", name: "server_search", max_uses: 1 },
          {
            name: "web_search",
            description: "A colliding client tool.",
            input_schema: { type: "object", properties: { q: { type: "string" } } },
          },
          {
            name: "Read",
            description: "Read files.",
            input_schema: { type: "object", properties: { file_path: { type: "string" } } },
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(upstreamToolNames(upstreamBodies[0])).toEqual(["web_search", "Read"]);
    const nativeTool = upstreamTools(upstreamBodies[0])[0]?.function;
    expect(nativeTool?.parameters).toMatchObject({
      type: "object",
      required: ["query"],
    });
  });

  test("converts server_tool_use history into OpenAI tool calls", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_server_tool_history",
            choices: [{ message: { content: "SERVER_TOOL_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "server_tool_use",
                id: "srvu_123",
                name: "web_search",
                input: { query: "Together AI" },
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const assistant = upstreamMessages(upstreamBodies[0]).find((message) =>
      Array.isArray(message.tool_calls),
    );
    expect(assistant?.tool_calls).toEqual([
      {
        id: "srvu_123",
        type: "function",
        function: { name: "web_search", arguments: '{"query":"Together AI"}' },
      },
    ]);
  });

  test("formats web_search_tool_result history into readable tool messages", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_web_result_history",
            choices: [{ message: { content: "WEB_RESULT_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "web_search_tool_result",
                tool_use_id: "srvu_search",
                content: [
                  { title: "Together docs", url: "https://docs.together.ai", text: "API docs" },
                ],
              },
              {
                type: "web_search_tool_result_error",
                tool_use_id: "srvu_error",
                error_code: "rate_limited",
                content: "Try later",
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const toolMessages = upstreamMessages(upstreamBodies[0]).filter(
      (message) => message.role === "tool",
    );
    expect(toolMessages[0]).toMatchObject({
      tool_call_id: "srvu_search",
    });
    expect(String(toolMessages[0]?.content)).toContain("Together docs");
    expect(String(toolMessages[0]?.content)).toContain("https://docs.together.ai");
    expect(toolMessages[1]).toMatchObject({
      tool_call_id: "srvu_error",
    });
    expect(String(toolMessages[1]?.content)).toContain("rate_limited");
  });

  test("formats rich tool_result content arrays and error status", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl_rich_tool_result",
            choices: [{ message: { content: "RICH_TOOL_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const response = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "call_rich",
                is_error: true,
                content: [
                  { type: "text", text: "Async agent launched successfully." },
                  {
                    type: "image",
                    source: { type: "base64", media_type: "image/png", data: "abc" },
                  },
                  { type: "url", url: "https://example.com/image.png" },
                ],
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const toolMessage = upstreamMessages(upstreamBodies[upstreamBodies.length - 1]).find(
      (message) => message.role === "tool",
    );
    expect(toolMessage?.tool_call_id).toBe("call_rich");
    expect(String(toolMessage?.content)).toContain("[tool_result error]");
    expect(String(toolMessage?.content)).toContain("Async agent launched successfully.");
    expect(String(toolMessage?.content)).toMatch(/image|Image description/);
    expect(String(toolMessage?.content)).toContain("[described by");
  });

  test("executes streamed native web_search server tools inside the proxy", async () => {
    vi.stubEnv("EXA_API_KEY", "test-exa-key");
    const upstreamBodies: Array<Record<string, unknown>> = [];
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(url);
        if (url.includes("api.exa.ai/search")) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  title: "Native search result",
                  url: "https://example.com/native",
                  text: "Result text from Exa.",
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        if (upstreamBodies.length === 1) {
          return sseResponse([
            {
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: "call_native_search",
                        function: { name: "web_search", arguments: '{"query":"native search"}' },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 20, completion_tokens: 4, total_tokens: 24 },
            },
            { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
          ]);
        }

        return sseResponse([
          {
            choices: [{ delta: { content: "NATIVE_STREAM_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 40, completion_tokens: 3, total_tokens: 43 },
          },
        ]);
      }),
    );

    const response = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        stream: true,
        messages: [{ role: "user", content: "Use native search." }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
      }),
    });

    expect(response.status).toBe(200);
    expect(urls.some((url) => url.includes("api.exa.ai/search"))).toBe(true);
    expect(upstreamBodies).toHaveLength(2);
    expect(String(response.body)).toContain("NATIVE_STREAM_OK");
    expect(String(response.body)).not.toContain('"name":"web_search"');
    const secondMessages = upstreamMessages(upstreamBodies[1]);
    expect(
      secondMessages.some(
        (message) => message.role === "tool" && message.tool_call_id === "call_native_search",
      ),
    ).toBe(true);
  });

  test("passes stop_sequences upstream in buffered and streaming requests", async () => {
    const upstreamBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        upstreamBodies.push(body);
        if (body.stream) {
          return sseResponse([
            {
              choices: [{ delta: { content: "STOP_STREAM_OK" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
            },
          ]);
        }
        return new Response(
          JSON.stringify({
            id: "chatcmpl_stop_buffered",
            choices: [{ message: { content: "STOP_BUFFERED_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
    );

    const buffered = await callClaudeProxy({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        stop_sequences: ["</done>"],
        messages: [{ role: "user", content: "Stop buffered." }],
      }),
    });
    const streamed = await callClaudeProxyRaw({
      method: "POST",
      url: "/v1/messages",
      body: JSON.stringify({
        model: GLM_5_2.anthropicAlias,
        max_tokens: 128,
        stream: true,
        stop_sequences: ["</done>"],
        messages: [{ role: "user", content: "Stop stream." }],
      }),
    });

    expect(buffered.status).toBe(200);
    expect(streamed.status).toBe(200);
    expect(upstreamBodies.map((body) => body.stop)).toEqual([["</done>"], ["</done>"]]);
  });
});

function claudeCompactionPrompt(prefix: string): string {
  return `${prefix}

CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.

- Do NOT use Read, Bash, Grep, Glob, Edit, Write, or ANY other tool.
- Your entire response must be plain text: an <analysis> block followed by a <summary> block.

Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.

Your summary should include the following sections:

3. Files and Code Sections: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable and include a summary of why this file read or edit is important.

6. All user messages:
    - List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.
`;
}

function firstUserContent(body: Record<string, unknown> | undefined): unknown {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const userMessage = messages.find((message) => {
    return (
      typeof message === "object" &&
      message !== null &&
      (message as { role?: unknown }).role === "user"
    );
  });
  return typeof userMessage === "object" && userMessage !== null
    ? (userMessage as { content?: unknown }).content
    : undefined;
}

function upstreamMessages(body: Record<string, unknown> | undefined): Array<{
  role?: unknown;
  content?: unknown;
  tool_call_id?: unknown;
  tool_calls?: unknown;
}> {
  return Array.isArray(body?.messages)
    ? (body.messages as Array<{
        role?: unknown;
        content?: unknown;
        tool_call_id?: unknown;
        tool_calls?: unknown;
      }>)
    : [];
}

function upstreamTools(
  body: Record<string, unknown> | undefined,
): Array<{ function?: { name?: string; parameters?: unknown } }> {
  return Array.isArray(body?.tools)
    ? (body.tools as Array<{ function?: { name?: string; parameters?: unknown } }>)
    : [];
}

function upstreamToolNames(body: Record<string, unknown> | undefined): string[] {
  return upstreamTools(body)
    .map((tool) => tool.function?.name)
    .filter((name): name is string => typeof name === "string");
}

async function callClaudeProxy({
  method,
  url,
  body,
  options,
}: {
  method: string;
  url: string;
  body?: string;
  options?: Partial<ClaudeProxyOptions>;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const req = Readable.from(body ? [body] : []) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { authorization: "Bearer local-token" };
  const res = new MemoryResponse() as unknown as ServerResponse;

  await handleProxyRequest(req, res, proxyOptions(options));

  const memoryRes = res as unknown as MemoryResponse;
  return {
    status: memoryRes.status,
    body: JSON.parse(memoryRes.body || "{}") as Record<string, unknown>,
  };
}

async function callClaudeProxyRaw({
  method,
  url,
  body,
}: {
  method: string;
  url: string;
  body?: string;
}): Promise<{ status: number; body: string }> {
  const req = Readable.from(body ? [body] : []) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { authorization: "Bearer local-token" };
  const res = new MemoryResponse() as unknown as ServerResponse;

  await handleProxyRequest(req, res, proxyOptions());

  const memoryRes = res as unknown as MemoryResponse;
  return {
    status: memoryRes.status,
    body: memoryRes.body,
  };
}

class MemoryResponse extends EventEmitter {
  status = 200;
  body = "";
  writableEnded = false;

  writeHead(status: number): this {
    this.status = status;
    return this;
  }

  write(chunk?: unknown): boolean {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    return true;
  }

  end(chunk?: unknown): this {
    if (chunk !== undefined) {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    this.writableEnded = true;
    return this;
  }
}

function sseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function proxyOptions(overrides: Partial<ClaudeProxyOptions> = {}): ClaudeProxyOptions {
  return {
    apiKey: "test-together-key",
    modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
    targetModelId: GLM_5_2.id,
    modelName: GLM_5_2.name,
    modelDefinition: GLM_5_2 as ModelDefinition,
    authToken: "local-token",
    ...overrides,
  };
}
