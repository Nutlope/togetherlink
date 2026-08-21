import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { runProxiedSession } from "../../cli/src/lib/proxied-session.js";
import { cleanupTmpDir, createTestContext } from "../src/context.js";
import { startTestDaemon, type TestDaemon } from "../src/daemon-session.js";
import type { TestContext } from "../src/types.js";

describe("proxied background session lifecycle", () => {
  let context: TestContext;
  let daemon: TestDaemon;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
    vi.stubEnv("TOGETHERLINK_HOME", daemon.home);
    vi.stubEnv("TOGETHERLINK_PORT", new URL(daemon.url).port);
    vi.stubEnv("TOGETHERLINK_TELEMETRY_DISABLED", "1");

    // Keep one persistent registration active so ensureDaemon reuses this
    // intentionally isolated test daemon even though Vitest is the parent
    // process rather than the CLI entrypoint that launched it.
    const seed = await fetch(`${daemon.url}/internal/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "persistent-test-seed",
        agent: "codex-app",
        apiKey: "test-key-never-sent-upstream",
        modelLabel: GLM_5_2.name,
        modelId: GLM_5_2.id,
        targetModelId: GLM_5_2.id,
        modelName: GLM_5_2.name,
        modelDefinition: GLM_5_2,
      }),
    });
    expect(seed.ok).toBe(true);
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("leaves a successful detached worker route active without the launcher pid", async () => {
    const result = await runProxiedSession({
      agent: "claude",
      apiKey: "test-key-never-sent-upstream",
      baseUrl: "https://api.together.ai/v1",
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      binary: process.execPath,
      args: [],
      buildArgs: () => ["-e", "process.exit(0)"],
      buildEnv: () => ({ ...process.env }),
      banner: () => "",
      keepaliveLabel: "test background session",
      preserveSessionAfterExit: true,
    });

    expect(result).toEqual({ status: 0, signal: null });
    const response = await fetch(`${daemon.url}/internal/sessions`);
    const body = (await response.json()) as {
      sessions?: Array<{ agent?: string; pid?: number; status?: string }>;
    };
    const background = body.sessions?.find((session) => session.agent === "claude");
    expect(background).toMatchObject({ agent: "claude", status: "running" });
    expect(background?.pid).toBeUndefined();

    const failed = await runProxiedSession({
      agent: "claude",
      apiKey: "test-key-never-sent-upstream",
      baseUrl: "https://api.together.ai/v1",
      modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
      targetModelId: GLM_5_2.id,
      modelName: GLM_5_2.name,
      modelDefinition: GLM_5_2,
      binary: process.execPath,
      args: [],
      buildArgs: () => ["-e", "process.exit(1)"],
      buildEnv: () => ({ ...process.env }),
      banner: () => "",
      keepaliveLabel: "test failed background session",
      preserveSessionAfterExit: true,
    });

    expect(failed).toEqual({ status: 1, signal: null });
    const afterFailure = await fetch(`${daemon.url}/internal/sessions`);
    const afterFailureBody = (await afterFailure.json()) as {
      sessions?: Array<{ agent?: string }>;
    };
    expect(afterFailureBody.sessions?.filter((session) => session.agent === "claude")).toHaveLength(
      1,
    );
  });

  test("forwards a Codex Auto session through the opted-in hosted gateway", async () => {
    const gatewayPaths: string[] = [];
    const gatewayAuthorizations: string[] = [];
    const gatewayFrontierKeys: string[] = [];
    const gatewaySessionIds: string[] = [];
    const gatewayPinnedModels: string[] = [];
    const gatewayContentEncodings: string[] = [];
    const gatewayBodies: string[] = [];
    const gateway = createServer(async (req, res) => {
      gatewayPaths.push(req.url ?? "");
      gatewayAuthorizations.push(String(req.headers.authorization ?? ""));
      gatewayFrontierKeys.push(String(req.headers["x-togetherlink-frontier-api-key"] ?? ""));
      gatewaySessionIds.push(String(req.headers["x-togetherlink-session-id"] ?? ""));
      gatewayPinnedModels.push(String(req.headers["x-togetherlink-pinned-model"] ?? ""));
      gatewayContentEncodings.push(String(req.headers["content-encoding"] ?? ""));
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks);
      gatewayBodies.push(
        req.headers["content-encoding"] === "gzip"
          ? gunzipSync(rawBody).toString("utf8")
          : rawBody.toString("utf8"),
      );
      if (req.url !== "/v1/responses") {
        res.writeHead(418, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "request was translated locally" } }));
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "x-togetherlink-tier": "fast",
        "x-togetherlink-resolved-model": GLM_5_2.id,
      });
      res.end(
        'event: response.completed\ndata: {"type":"response.completed","marker":"REMOTE_AUTO_OK"}\n\n',
      );
    });
    gateway.listen(0, "127.0.0.1");
    await once(gateway, "listening");

    try {
      const gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}/v1`;
      const token = "gateway-auto-test";
      const register = await fetch(`${daemon.url}/internal/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          authToken: token,
          agent: "codex",
          apiKey: "together-user-key",
          frontierApiKey: "openai-user-key",
          baseUrl: gatewayUrl,
          gatewayBaseUrl: gatewayUrl,
          routeSessionId: "stable-gateway-session",
          modelId: "auto",
          targetModelId: "auto",
          modelName: "Auto",
          modelLabel: "Auto",
          modelDefinition: { ...GLM_5_2, id: "auto", name: "Auto" },
        }),
      });
      expect(register.ok).toBe(true);
      const sessionUrl = `${daemon.url}/session/${token}`;
      const headers = { authorization: `Bearer ${token}` };
      const models = await fetch(`${sessionUrl}/v1/models`, { headers });
      const catalog = (await models.json()) as { models: Array<{ slug: string }> };
      expect(models.ok).toBe(true);
      expect(catalog.models.some((model) => model.slug === "auto")).toBe(true);

      for (const input of ["hello", "x".repeat(70_000)]) {
        const response = await fetch(`${sessionUrl}/v1/responses`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ model: "auto", input, stream: true }),
        });
        const body = await response.text();
        expect(response.ok).toBe(true);
        expect(body).toContain("REMOTE_AUTO_OK");
        expect(response.headers.get("x-togetherlink-tier")).toBe("fast");
        expect(response.headers.get("x-togetherlink-resolved-model")).toBe(GLM_5_2.id);
      }

      await fetch(`${daemon.url}/internal/sessions/${token}`, { method: "DELETE" });
      expect(gatewayPaths).toEqual(["/v1/responses", "/v1/responses"]);
      expect(gatewayAuthorizations).toEqual([
        "Bearer together-user-key",
        "Bearer together-user-key",
      ]);
      expect(gatewayFrontierKeys).toEqual(["openai-user-key", "openai-user-key"]);
      expect(gatewaySessionIds[0]).toBeTruthy();
      expect(gatewaySessionIds[1]).toBe(gatewaySessionIds[0]);
      expect(gatewayPinnedModels).toEqual(["", GLM_5_2.id]);
      expect(gatewayContentEncodings).toEqual(["", "gzip"]);
      expect(gatewayBodies.map((body) => JSON.parse(body))).toEqual([
        expect.objectContaining({ model: "auto" }),
        expect.objectContaining({ model: "auto" }),
      ]);
    } finally {
      gateway.close();
      await once(gateway, "close");
    }
  });
});
