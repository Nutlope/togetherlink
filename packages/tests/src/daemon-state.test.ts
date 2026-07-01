import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildSession,
  toPublicSessionView,
  type RegisterSessionRequest,
} from "../../cli/src/lib/daemon/state.js";

const MODEL = {
  id: "zai-org/GLM-5.2",
  name: "GLM 5.2",
  anthropicAlias: "together-glm-5-2",
  cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
  limit: { context: 262144, output: 164000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
} satisfies RegisterSessionRequest["modelDefinition"];

describe("daemon session state", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("aggregates proxy perf payloads only when perf mode is enabled", () => {
    const disabledSession = buildSession(registerBody("disabled"));
    expect(disabledSession.options?.perfSink).toBeUndefined();
    expect(toPublicSessionView(disabledSession).proxyPerf).toBeUndefined();

    vi.stubEnv("TOGETHERLINK_PERF", "1");
    const enabledSession = buildSession(registerBody("enabled"));

    enabledSession.options?.perfSink?.({
      name: "claude.proxy",
      totalMs: 42,
      fields: { path: "/v1/messages" },
      result: { status: 200, stream: true },
      spans: [
        { name: "body_read_parse", durationMs: 2, atMs: 2 },
        {
          name: "vision_image_resolution",
          durationMs: 8,
          atMs: 10,
          fields: { imageBlockCount: 2 },
        },
        { name: "upstream_fetch", durationMs: 25, atMs: 40 },
      ],
      marks: [{ name: "first_delta", atMs: 12, fields: { kind: "text" } }],
    });

    expect(toPublicSessionView(enabledSession).proxyPerf).toEqual({
      requestCount: 1,
      totalMs: 42,
      maxMs: 42,
      firstDelta: { count: 1, totalMs: 12, maxMs: 12 },
      spans: {
        body_read_parse: { count: 1, totalMs: 2, maxMs: 2 },
        upstream_fetch: { count: 1, totalMs: 25, maxMs: 25 },
        vision_image_resolution: { count: 1, totalMs: 8, maxMs: 8 },
      },
    });
  });
});

function registerBody(token: string): RegisterSessionRequest {
  return {
    token,
    agent: "claude",
    apiKey: "test-key",
    modelLabel: MODEL.name,
    modelId: MODEL.anthropicAlias,
    targetModelId: MODEL.id,
    modelName: MODEL.name,
    modelDefinition: MODEL,
  };
}
