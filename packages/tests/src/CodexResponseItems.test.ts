import * as http from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2, KIMI_K3 } from "@togetherlink/models";
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

describe("Codex Responses item compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("discovers tool definitions carried by additional_tools items", async () => {
    const upstream = captureTogetherPayload();

    await postResponses([
      {
        type: "additional_tools",
        id: "at_1",
        role: "developer",
        tools: [
          null,
          "unknown future tool payload",
          {
            type: "function",
            name: "resume_lookup",
            description: "Look up resumed state.",
            parameters: {
              type: "object",
              properties: { key: { type: "string" } },
              required: ["key"],
            },
          },
        ],
      },
      message("user", [{ type: "input_text", text: "Continue the task." }]),
    ]);

    expect(upstream.body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "resume_lookup",
          description: "Look up resumed state.",
          parameters: {
            type: "object",
            properties: { key: { type: "string" } },
            required: ["key"],
          },
        },
      },
    ]);
  });

  test("preserves agent-message routing and plaintext without exposing ciphertext", async () => {
    const upstream = captureTogetherPayload();

    await postResponses([
      {
        type: "agent_message",
        id: "amsg_1",
        author: "/root/researcher",
        recipient: "/root",
        content: [
          { type: "input_text", text: "The endpoint contract is confirmed." },
          { type: "encrypted_content", encrypted_content: "cipher-DO-NOT-LEAK" },
        ],
      },
      message("user", [{ type: "input_text", text: "Use the research." }]),
    ]);

    const serialized = JSON.stringify(upstream.body.messages);
    expect(upstream.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining(
            "Agent message from /root/researcher to /root: The endpoint contract is confirmed.",
          ),
        }),
      ]),
    );
    expect(serialized).toContain("encrypted content unavailable");
    expect(serialized).not.toContain("cipher-DO-NOT-LEAK");
  });

  test("pairs local shell history with its following function output", async () => {
    const upstream = captureTogetherPayload();

    await postResponses([
      {
        type: "local_shell_call",
        id: "lsh_1",
        call_id: "call_shell_1",
        status: "completed",
        action: {
          type: "exec",
          command: ["git", "status", "--short"],
          timeout_ms: 30_000,
          working_directory: "/workspace",
          env: { CI: "1" },
          user: "runner",
        },
      },
      {
        type: "function_call_output",
        call_id: "call_shell_1",
        output: " M packages/cli/src/index.ts",
      },
    ]);

    expect(upstream.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          tool_calls: [
            {
              id: "call_shell_1",
              type: "function",
              function: {
                name: "local_shell",
                arguments: JSON.stringify({
                  type: "exec",
                  command: ["git", "status", "--short"],
                  timeout_ms: 30_000,
                  working_directory: "/workspace",
                  env: { CI: "1" },
                  user: "runner",
                }),
              },
            },
          ],
        }),
        {
          role: "tool",
          tool_call_id: "call_shell_1",
          content: " M packages/cli/src/index.ts",
        },
      ]),
    );
  });

  test("sanitizes structured tool output without leaking opaque or unsupported media", async () => {
    const upstream = captureTogetherPayload();

    await postResponses([
      {
        type: "function_call",
        call_id: "call_structured",
        name: "inspect_media",
        arguments: "{}",
      },
      {
        type: "function_call_output",
        call_id: "call_structured",
        output: [
          { type: "input_text", text: "visible result" },
          { type: "input_image", image_url: "data:image/png;base64,IMAGE-DO-NOT-LEAK" },
          { type: "input_audio", audio_url: "data:audio/wav;base64,AUDIO-DO-NOT-LEAK" },
          { type: "encrypted_content", encrypted_content: "CIPHER-DO-NOT-LEAK" },
        ],
      },
    ]);

    const serialized = JSON.stringify(upstream.body.messages);
    expect(serialized).toContain("visible result");
    expect(serialized).toContain("Image output is unavailable to the selected Together model");
    expect(serialized).toContain("Audio output is unavailable to the selected Together model");
    expect(serialized).toContain("Encrypted tool output is unavailable");
    expect(serialized).not.toContain("IMAGE-DO-NOT-LEAK");
    expect(serialized).not.toContain("AUDIO-DO-NOT-LEAK");
    expect(serialized).not.toContain("CIPHER-DO-NOT-LEAK");
  });

  test("keeps web, image, compaction, and unavailable-audio history as safe markers", async () => {
    const upstream = captureTogetherPayload();

    await postResponses([
      {
        type: "web_search_call",
        id: "ws_1",
        status: "completed",
        action: { type: "search", query: "current Codex contract" },
      },
      {
        type: "image_generation_call",
        id: "ig_1",
        status: "completed",
        revised_prompt: "A safe architecture diagram",
        result: "base64-IMAGE-DO-NOT-LEAK",
      },
      {
        type: "context_compaction",
        id: "cmp_1",
        encrypted_content: "opaque-COMPACTION-DO-NOT-LEAK",
      },
      message("user", [
        { type: "input_text", text: "The attached audio contains requirements." },
        { type: "input_audio", audio_url: "data:audio/wav;base64,AUDIO-DO-NOT-LEAK" },
      ]),
    ]);

    const serialized = JSON.stringify(upstream.body.messages);
    expect(serialized).toContain("Web search completed");
    expect(serialized).toContain("current Codex contract");
    expect(serialized).toContain("Image generation completed");
    expect(serialized).toContain("A safe architecture diagram");
    expect(serialized).toContain("Conversation context was compacted");
    expect(serialized).toContain("Audio input is unavailable to the selected Together model");
    expect(serialized).not.toContain("base64-IMAGE-DO-NOT-LEAK");
    expect(serialized).not.toContain("opaque-COMPACTION-DO-NOT-LEAK");
    expect(serialized).not.toContain("AUDIO-DO-NOT-LEAK");
  });

  test("replays image-generation results to a vision-capable Together model", async () => {
    const upstream = captureTogetherPayload();
    const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

    await postResponses(
      [
        {
          type: "image_generation_call",
          id: "ig_vision",
          status: "completed",
          revised_prompt: "A blue architecture diagram",
          result: imageBase64,
        },
      ],
      {
        ...options,
        modelId: KIMI_K3.id,
        targetModelId: KIMI_K3.id,
        modelName: KIMI_K3.name,
        modelDefinition: KIMI_K3,
      },
    );

    expect(upstream.body.messages).toEqual(
      expect.arrayContaining([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "[Image generation completed: A blue architecture diagram.]",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
          ],
        },
      ]),
    );
  });
});

function captureTogetherPayload(): { body: Record<string, any> } {
  const captured = { body: {} as Record<string, any> };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) {
        return realFetch(url, init);
      }
      captured.body = JSON.parse(String(init?.body)) as Record<string, any>;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Done." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
  return captured;
}

function message(role: "user" | "assistant", content: unknown[]): Record<string, unknown> {
  return { type: "message", role, content };
}

async function postResponses(
  input: unknown[],
  proxyOptions: CodexProxyOptions = options,
): Promise<void> {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: proxyOptions.modelId, stream: false, input }),
    });
    expect(response.status).toBe(200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
