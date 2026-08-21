import http from "node:http";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import type { ReasoningHistoryMode } from "../../cli/src/lib/reasoning-history.js";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

type ProxiedAgent = "claude" | "codex" | "codex-app";

type CapturedUpstreamRequest = {
  path: string;
  authorization?: string;
  body: {
    messages?: Array<Record<string, unknown>>;
    chat_template_kwargs?: { clear_thinking?: boolean };
  };
};

describe("reasoning history network boundary", () => {
  let context: TestContext;
  let daemon: TestDaemon;
  let upstream: http.Server;
  let upstreamBaseUrl: string;
  const captured: CapturedUpstreamRequest[] = [];

  beforeAll(async () => {
    context = await createTestContext();
    upstream = http.createServer((req, res) => {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        captured.push({
          path: req.url ?? "",
          ...(typeof req.headers.authorization === "string"
            ? { authorization: req.headers.authorization }
            : {}),
          body: JSON.parse(raw) as CapturedUpstreamRequest["body"],
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: "NETWORK_OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 20, completion_tokens: 2, total_tokens: 22 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("fake Together upstream did not bind");
    }
    upstreamBaseUrl = `http://127.0.0.1:${address.port}/v1`;
    daemon = await startTestDaemon(context);
  }, 30_000);

  afterAll(async () => {
    await daemon?.stop();
    if (upstream) {
      await new Promise<void>((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await cleanupTmpDir(context);
  });

  for (const agent of ["claude", "codex", "codex-app"] as const) {
    for (const mode of ["off", "interleaved", "full"] as const) {
      test(`${agent} enforces ${mode} in the HTTP request sent upstream`, async () => {
        const token = `${agent}-${mode}`;
        const registration = await fetch(`${daemon.url}/internal/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            authToken: `auth-${token}`,
            agent,
            apiKey: "network-test-together-key",
            baseUrl: upstreamBaseUrl,
            modelLabel: GLM_5_2.name,
            modelId: agent === "claude" ? GLM_5_2.anthropicAlias : GLM_5_2.id,
            targetModelId: GLM_5_2.id,
            modelName: GLM_5_2.name,
            modelDefinition: GLM_5_2,
            reasoningHistoryMode: mode,
          }),
        });
        expect(registration.status).toBe(200);

        const before = captured.length;
        const response = await sendProxiedRequest(daemon.url, token, agent, mode);
        expect(response.status).toBe(200);
        expect(captured).toHaveLength(before + 1);

        const request = captured.at(-1);
        expect(request).toMatchObject({
          path: "/v1/chat/completions",
          authorization: "Bearer network-test-together-key",
          body: {
            chat_template_kwargs: { clear_thinking: mode !== "full" },
          },
        });
        const assistant = request?.body.messages?.find((message) => message.role === "assistant");
        expect(assistant).toMatchObject({ role: "assistant", content: "READY" });
        if (mode === "off") {
          expect(assistant?.reasoning_content).toBeUndefined();
        } else {
          expect(assistant?.reasoning_content).toBe(reasoningMarker(agent, mode));
        }
      });
    }
  }
});

async function sendProxiedRequest(
  daemonUrl: string,
  token: string,
  agent: ProxiedAgent,
  mode: ReasoningHistoryMode,
): Promise<Response> {
  const url = `${daemonUrl}/session/${token}${agent === "claude" ? "/v1/messages" : "/v1/responses"}`;
  return await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer auth-${token}`,
    },
    body: JSON.stringify(agent === "claude" ? claudeRequest(mode) : codexRequest(agent, mode)),
  });
}

function claudeRequest(mode: ReasoningHistoryMode): Record<string, unknown> {
  return {
    model: GLM_5_2.anthropicAlias,
    max_tokens: 128,
    messages: [
      { role: "user", content: "Start." },
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: reasoningMarker("claude", mode),
            signature: "togetherlink:network-test",
          },
          { type: "text", text: "READY" },
        ],
      },
      { role: "user", content: "Continue." },
    ],
  };
}

function codexRequest(agent: Exclude<ProxiedAgent, "claude">, mode: ReasoningHistoryMode) {
  return {
    model: GLM_5_2.id,
    input: [
      { type: "message", role: "user", content: "Start." },
      {
        type: "reasoning",
        content: [{ type: "reasoning_text", text: reasoningMarker(agent, mode) }],
      },
      { type: "message", role: "assistant", content: "READY" },
      { type: "message", role: "user", content: "Continue." },
    ],
  };
}

function reasoningMarker(agent: ProxiedAgent, mode: ReasoningHistoryMode): string {
  return `NETWORK_REASONING_${agent}_${mode}`;
}
