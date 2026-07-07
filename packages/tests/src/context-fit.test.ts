import { describe, expect, test, vi, afterEach } from "vitest";
import type { ModelDefinition } from "../../models/src/index.js";
import {
  applyContextFit,
  contextLengthOverflow,
  dropOldestTurns,
  newContextFitState,
  stripOldImages,
  trimPayloadMessages,
} from "../../cli/src/lib/context-fit.js";
import { postChatCompletion, postChatCompletionStream } from "../../cli/src/lib/together-client.js";

const TRIM_MARKER = "[togetherlink trimmed older context to fit the model window]";
const IMAGE_PLACEHOLDER = "[togetherlink removed an older image to fit the model window]";

const model: ModelDefinition = {
  id: "test/fit-model",
  name: "Fit Model",
  anthropicAlias: "fit-model",
  cost: { input: 0, output: 0, cache_read: 0 },
  limit: { context: 262144, output: 32000 },
  attachment: true,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text", "image"], output: ["text"] },
};

const overflowMessage = (inputTokens: number) =>
  `This model's maximum context length is 262144 tokens, but the request resolved to ${inputTokens} input tokens (including image/vision expansion).`;

const longText = (n: number) => "old context ".repeat(n);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("contextLengthOverflow", () => {
  test("extracts input + context tokens, ignores non-context 400s", () => {
    expect(contextLengthOverflow(overflowMessage(262323), model)).toEqual({
      inputTokens: 262323,
      contextTokens: 262144,
    });
    expect(contextLengthOverflow("template render error: 'items'", model)).toBeUndefined();
  });
});

describe("trimPayloadMessages", () => {
  test("trims text inside array content and skips system messages", () => {
    const messages = [
      { role: "system", content: "keep me" },
      {
        role: "user",
        content: [
          { type: "text", text: `prefix ${longText(2000)}` },
          { type: "image_url", image_url: { url: "https://x/y.png" } },
        ],
      },
    ];
    const result = trimPayloadMessages(messages, 4000);
    expect(result?.trimmedChars).toBeGreaterThan(0);
    expect(messages[0]?.content).toBe("keep me");
    const part = (messages[1]?.content as Array<{ type: string; text?: string }>)[0];
    expect(part?.text).toContain(TRIM_MARKER);
  });
});

describe("stripOldImages", () => {
  test("keeps the most recent image and placeholders older ones", () => {
    const messages = [
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }],
      },
      { role: "assistant", content: "ok" },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "data:image/png;base64,BBB" } }],
      },
    ];
    const result = stripOldImages(messages, 1);
    expect(result?.removedParts).toBe(1);
    const first = (messages[0]?.content as Array<{ type: string; text?: string }>)[0];
    const last = (messages[2]?.content as Array<{ type: string; image_url?: unknown }>)[0];
    expect(first).toEqual({ type: "text", text: IMAGE_PLACEHOLDER });
    expect(last?.image_url).toBeDefined(); // most recent image preserved
  });

  test("returns undefined when nothing to strip", () => {
    expect(stripOldImages([{ role: "user", content: "no images" }], 1)).toBeUndefined();
  });
});

describe("dropOldestTurns", () => {
  test("drops oldest whole turn, preserves system + latest user turn + tool pairing", () => {
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: "sys" },
      { role: "user", content: "first turn" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "t1", type: "function", function: { name: "f", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "t1", content: "result" },
      { role: "user", content: "latest turn" },
    ];
    const result = dropOldestTurns(messages, 5);
    expect(result?.droppedMessages).toBe(3);
    expect(messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(messages[1]?.content).toBe("latest turn");
    // No orphaned tool result left at the head.
    expect(messages.some((m) => m.role === "tool")).toBe(false);
  });

  test("refuses to drop the only remaining user turn", () => {
    const messages = [
      { role: "system", content: "sys" },
      { role: "user", content: "only turn" },
    ];
    expect(dropOldestTurns(messages, 100000)).toBeUndefined();
  });
});

describe("applyContextFit ladder", () => {
  test("rung 1: clamps max_tokens when input alone fits", () => {
    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 30000,
      messages: [{ role: "user", content: "hi" }],
    };
    const outcome = applyContextFit(
      payload,
      overflowMessage(250000),
      model,
      newContextFitState(payload),
    );
    expect(outcome).toMatchObject({ mutated: true, action: "max_tokens" });
    expect(payload.max_tokens).toBeLessThan(30000);
  });

  test("rung 2: strips old images when input exceeds the window", () => {
    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }],
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "data:image/png;base64,BBB" } }],
        },
      ],
    };
    const outcome = applyContextFit(
      payload,
      overflowMessage(263000),
      model,
      newContextFitState(payload),
    );
    expect(outcome.action).toBe("strip_images");
  });

  test("rung 4: drops oldest turns when text can't be trimmed further", () => {
    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 4000,
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ],
    };
    const outcome = applyContextFit(
      payload,
      overflowMessage(263000),
      model,
      newContextFitState(payload),
    );
    expect(outcome.action).toBe("drop_turns");
    expect((payload.messages as unknown[]).length).toBeLessThan(3);
  });

  test("floor: returns not-mutated when only the latest turn remains", () => {
    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 4000,
      messages: [{ role: "user", content: "x" }],
    };
    const outcome = applyContextFit(
      payload,
      overflowMessage(263000),
      model,
      newContextFitState(payload),
    );
    expect(outcome.mutated).toBe(false);
  });
});

describe("together-client context-fit retry", () => {
  test("self-heals a context-length 400 and re-posts until it fits", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        bodies.push(body);
        if (bodies.length === 1) {
          return new Response(JSON.stringify({ error: { message: overflowMessage(263000) } }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ id: "ok", choices: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const payload: Record<string, unknown> = {
      model: model.id,
      max_tokens: 4000,
      messages: [
        { role: "user", content: longText(3000) },
        { role: "user", content: "answer please" },
      ],
    };
    const response = await postChatCompletion(payload, { apiKey: "k" }, undefined, {
      modelDefinition: model,
      onContextTrim: () => {}, // suppress real stderr/telemetry
    });

    expect(response.ok).toBe(true);
    expect(bodies).toHaveLength(2);
    const retriedFirstUser = (bodies[1]?.messages as Array<{ content: string }>)[0]?.content;
    expect(retriedFirstUser).toContain(TRIM_MARKER);
  });

  test("passes an OK stream response through with its body intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("data: hello\n\n", {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          }),
      ),
    );
    const response = await postChatCompletionStream(
      { model: model.id, messages: [{ role: "user", content: "hi" }] },
      { apiKey: "k" },
      undefined,
      undefined,
      { modelDefinition: model, onContextTrim: () => {} },
    );
    expect(response.ok).toBe(true);
    expect(await response.text()).toBe("data: hello\n\n");
  });
});
