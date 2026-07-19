import { mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import {
  appRegistrationPath,
  clearAppRegistration,
  readAppRegistration,
  writeAppRegistration,
} from "../../cli/src/lib/daemon/app-registration.js";
import type { RegisterSessionRequest } from "../../cli/src/lib/daemon/state.js";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { startTestDaemon, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

const TOKEN = "togetherlink-local-app-registration-test";

function registration(): RegisterSessionRequest {
  return {
    token: TOKEN,
    authToken: TOKEN,
    agent: "codex-app",
    apiKey: "fake-key-never-sent-upstream",
    baseUrl: "https://api.together.ai/v1",
    modelLabel: `${GLM_5_2.name} (Codex App alpha)`,
    modelId: GLM_5_2.id,
    targetModelId: GLM_5_2.id,
    modelName: GLM_5_2.name,
    modelDefinition: GLM_5_2,
  };
}

describe("app registration file", () => {
  let home: string;

  beforeAll(async () => {
    const context = await createTestContext();
    home = await mkdtemp(path.join(context.tmpDir, "app-reg-"));
  });

  test("round-trips a registration", async () => {
    await writeAppRegistration(registration(), home);
    const restored = await readAppRegistration(home);
    expect(restored).toEqual(registration());
  });

  test("clear removes the file", async () => {
    await writeAppRegistration(registration(), home);
    await clearAppRegistration(home);
    expect(await readAppRegistration(home)).toBeUndefined();
  });

  test("missing file reads as undefined", async () => {
    const empty = await mkdtemp(path.join(home, "empty-"));
    expect(await readAppRegistration(empty)).toBeUndefined();
  });

  test("malformed JSON reads as undefined", async () => {
    await writeAppRegistration(registration(), home);
    await writeFile(appRegistrationPath(home), "{ not json", "utf8");
    expect(await readAppRegistration(home)).toBeUndefined();
  });

  test("registration missing proxied-agent fields reads as undefined", async () => {
    const { targetModelId: _dropped, ...partial } = registration();
    await writeFile(appRegistrationPath(home), JSON.stringify(partial), "utf8");
    expect(await readAppRegistration(home)).toBeUndefined();
  });
});

describe("daemon lazy codex-app session restore", () => {
  let context: TestContext;
  let daemon: TestDaemon;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
  }, 30_000);

  afterAll(async () => {
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("re-registers the persisted codex-app session on a token miss instead of 401ing", async () => {
    // Simulate the state after a daemon restart / idle reap: the register
    // body is on disk (written by `togetherlink codex-app`) but the daemon
    // has no in-memory session for the token the Codex app keeps sending.
    await writeAppRegistration(registration(), daemon.home);
    const before = await sessionCount();
    expect(before).toBe(0);

    // /v1/models is served locally by the codex proxy, so this exercises the
    // full daemon auth path without needing a real Together API key.
    const response = await fetch(`${daemon.url}/session/${TOKEN}/v1/models`);
    expect(response.status).toBe(200);
    const catalog = (await response.json()) as { models?: Array<{ slug?: string }> };
    expect(catalog.models?.[0]?.slug).toBe(GLM_5_2.id);

    const sessions = await listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.agent).toBe("codex-app");
  }, 30_000);

  test("still 401s for tokens that do not match the persisted registration", async () => {
    const response = await fetch(`${daemon.url}/session/some-other-token/v1/models`);
    expect(response.status).toBe(401);
  });

  test("routes restored codex-app requests through its persisted upstream base URL", async () => {
    let upstreamPath = "";
    const upstream = http.createServer((req, res) => {
      upstreamPath = req.url ?? "";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "ROUTED" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("test upstream did not bind");
    }

    try {
      const restoredRegistration = registration();
      restoredRegistration.baseUrl = `http://127.0.0.1:${address.port}/together/v1`;
      await writeAppRegistration(restoredRegistration, daemon.home);
      await fetch(`${daemon.url}/internal/sessions/${encodeURIComponent(TOKEN)}`, {
        method: "DELETE",
      });

      const response = await fetch(`${daemon.url}/session/${TOKEN}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: GLM_5_2.id,
          input: [{ type: "message", role: "user", content: "route me" }],
        }),
      });

      expect(response.ok).toBe(true);
      expect(upstreamPath).toBe("/together/v1/chat/completions");
    } finally {
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });

  test("stops resurrecting the session after restore clears the registration", async () => {
    // `togetherlink codex-app --restore` deletes both the daemon session and
    // the persisted registration; the token must go back to 401.
    await fetch(`${daemon.url}/internal/sessions/${encodeURIComponent(TOKEN)}`, {
      method: "DELETE",
    });
    await clearAppRegistration(daemon.home);

    const response = await fetch(`${daemon.url}/session/${TOKEN}/v1/models`);
    expect(response.status).toBe(401);
    expect(await sessionCount()).toBe(0);
  });

  async function listSessions(): Promise<Array<{ agent?: string }>> {
    const response = await fetch(`${daemon.url}/internal/sessions`);
    const body = (await response.json()) as { sessions?: Array<{ agent?: string }> };
    return body.sessions ?? [];
  }

  async function sessionCount(): Promise<number> {
    return (await listSessions()).length;
  }
});
