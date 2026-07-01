import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanupTmpDir, createTestContext } from "./context.js";
import { registerClaudeSession, startTestDaemon, type TestDaemon } from "./daemon-session.js";
import type { TestContext } from "./types.js";

describe("daemon session-URL auth", () => {
  let context: TestContext;
  let daemon: TestDaemon;
  let token: string;

  beforeAll(async () => {
    context = await createTestContext();
    daemon = await startTestDaemon(context);
    token = await registerClaudeSession(context, daemon);
  }, 30_000);

  afterAll(async () => {
    await daemon?.stop();
    await cleanupTmpDir(context);
  });

  test("accepts a session-URL request whose bearer is a foreign OAuth token", async () => {
    // Claude Code 2.1.197+ overrides ANTHROPIC_AUTH_TOKEN with the user's
    // claude.ai OAuth token when they are logged in, so the Authorization
    // header no longer matches the session's authToken. The secret session-URL
    // path token already authenticates the request; the daemon must rewrite
    // the header instead of letting the claude proxy's header check 401 it.
    const response = await fetch(`${daemon.url}/session/${token}/v1/models?limit=1000`, {
      headers: { authorization: "Bearer sk-ant-oat01-not-the-session-token" },
    });
    expect(response.status).toBe(200);
  });

  test("still 401s bare-path requests with an unknown bearer", async () => {
    const response = await fetch(`${daemon.url}/v1/models?limit=1000`, {
      headers: { authorization: "Bearer sk-ant-oat01-not-the-session-token" },
    });
    expect(response.status).toBe(401);
  });

  test("still 401s unknown session-URL tokens", async () => {
    const response = await fetch(`${daemon.url}/session/not-a-registered-token/v1/models`);
    expect(response.status).toBe(401);
  });
});
