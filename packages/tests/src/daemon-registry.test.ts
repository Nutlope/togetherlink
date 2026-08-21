import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ModelDefinition } from "@togetherlink/models";
import {
  SessionRegistry,
  buildSession,
  type AgentId,
  type RegisterSessionRequest,
} from "@togetherlink/cli/dist/lib/daemon/state.js";

const cleanup: string[] = [];
afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Unit tests for the now-exported SessionRegistry (#5: the interface is the test
 * surface). These exercise register/get/delete/reapDead in isolation — no daemon
 * process, no HTTP, no port. Proves the registry is substitutable (constructable
 * + injectable) rather than reachable only through the singleton.
 */

const MODEL_DEF: ModelDefinition = {
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
};

function makeRequest(token: string, agent: AgentId = "claude"): RegisterSessionRequest {
  return {
    token,
    authToken: `auth-${token}`,
    agent,
    apiKey: "test-key",
    baseUrl: "https://api.together.ai/v1",
    modelLabel: "GLM 5.2",
    modelId: "together-glm-5-2",
    targetModelId: "zai-org/GLM-5.2",
    modelName: "GLM 5.2",
    modelDefinition: MODEL_DEF,
  };
}

describe("SessionRegistry (#5 — exported, injectable, testable in isolation)", () => {
  test("a fresh registry has size 0", () => {
    const reg = new SessionRegistry();
    expect(reg.size).toBe(0);
  });

  test("register + get round-trips a session", () => {
    const reg = new SessionRegistry();
    const state = buildSession(makeRequest("tok-1"));
    reg.register(state);
    expect(reg.size).toBe(1);
    const got = reg.get("tok-1");
    expect(got).toBeDefined();
    expect(got?.agent).toBe("claude");
    expect(got?.token).toBe("tok-1");
  });

  test("get on an unknown token returns undefined", () => {
    const reg = new SessionRegistry();
    expect(reg.get("nope")).toBeUndefined();
  });

  test("delete removes a session and returns true; second delete returns false", () => {
    const reg = new SessionRegistry();
    reg.register(buildSession(makeRequest("tok-2")));
    expect(reg.delete("tok-2")).toBe(true);
    expect(reg.size).toBe(0);
    expect(reg.delete("tok-2")).toBe(false);
    expect(reg.get("tok-2")).toBeUndefined();
  });

  test("list returns all registered sessions", () => {
    const reg = new SessionRegistry();
    reg.register(buildSession(makeRequest("a")));
    reg.register(buildSession(makeRequest("b")));
    const all = reg.list();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.token).sort()).toEqual(["a", "b"]);
  });

  test("updatePid records the pid on the session", () => {
    const reg = new SessionRegistry();
    reg.register(buildSession(makeRequest("tok-3")));
    expect(reg.updatePid("tok-3", 4242)).toBe(true);
    const got = reg.get("tok-3");
    expect(got?.pid).toBe(4242);
  });

  test("updatePid on an unknown token returns false", () => {
    const reg = new SessionRegistry();
    expect(reg.updatePid("ghost", 1)).toBe(false);
  });

  test("delete sets endedAt on the session (the side effect is now observable)", () => {
    const reg = new SessionRegistry();
    reg.register(buildSession(makeRequest("tok-4")));
    reg.delete("tok-4");
    // The session is gone from the map, but the delete side-effect (endedAt)
    // was applied before removal — proving the hidden telemetry/storage side
    // effects fire through the exported interface.
    expect(reg.get("tok-4")).toBeUndefined();
  });

  test("a codex session is proxied (isProxiedAgent)", async () => {
    const reg = new SessionRegistry();
    const state = buildSession(makeRequest("codex-1", "codex"));
    reg.register(state);
    const got = reg.get("codex-1");
    expect(got?.options).toBeDefined();
  });

  test("keeps different upstream base URLs isolated by daemon session", () => {
    const reg = new SessionRegistry();
    const first = makeRequest("first", "claude");
    first.baseUrl = "http://first.test/together/v1";
    const second = makeRequest("second", "codex");
    second.baseUrl = "http://second.test/together/v1";
    reg.register(buildSession(first));
    reg.register(buildSession(second));

    expect(reg.get("first")?.options?.baseUrl).toBe("http://first.test/together/v1");
    expect(reg.get("second")?.options?.baseUrl).toBe("http://second.test/together/v1");
  });

  test("updateUsage persists a never-ending proxied session's live cost to the store", () => {
    const home = mkdtempSync(join(tmpdir(), "togetherlink-registry-flush-"));
    cleanup.push(home);
    // Runs in a child node process so node:sqlite loads (it is not available
    // inside the vitest worker, where createSessionStore would fall back to a
    // no-op in-memory store). Mirrors daemon-storage.test.ts.
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { SessionRegistry, buildSession } from "./packages/cli/dist/lib/daemon/state.js";
          import { createSessionStore } from "./packages/cli/dist/lib/daemon/storage.js";
          import { GLM_5_2 } from "./packages/models/dist/index.js";
          const home = process.argv[1];
          const store = await createSessionStore(home);
          if (store.kind !== "sqlite") throw new Error("sqlite unavailable");
          const reg = new SessionRegistry(store);
          // codex-app registers without a pid, so it is never reaped while the app
          // is open — exactly the session whose spend otherwise never reaches the DB.
          reg.register(buildSession({
            token: "live",
            authToken: "auth-live",
            agent: "codex-app",
            apiKey: "test-key",
            modelLabel: GLM_5_2.name,
            modelId: GLM_5_2.anthropicAlias ?? GLM_5_2.id,
            targetModelId: GLM_5_2.id,
            modelName: GLM_5_2.name,
            modelDefinition: GLM_5_2,
          }));
          const state = reg.get("live");
          if (!state) throw new Error("session not registered");
          // 1M input tokens at $1.4/M => $1.40 — a clean, exact figure.
          state.costTracker.addUsage(1_000_000, 0, 0, GLM_5_2);
          reg.updateUsage("live");
          process.stdout.write(JSON.stringify(store.queryUsageSince(0)));
          store.close();
        `,
        home,
      ],
      { cwd: join(process.cwd(), "..", ".."), encoding: "utf8" },
    );

    const usage = JSON.parse(output);
    expect(usage).toHaveLength(1);
    expect(usage[0].agent).toBe("codex-app");
    expect(usage[0].costUsd).toBeCloseTo(1.4, 6);
    expect(usage[0].usageByModel).toHaveLength(1);
    expect(usage[0].usageByModel[0].model).toBe("zai-org/GLM-5.2");
    expect(usage[0].usageByModel[0].promptTokens).toBe(1_000_000);
    expect(usage[0].usageByModel[0].completionTokens).toBe(0);
    expect(usage[0].usageByModel[0].costUsd).toBeCloseTo(1.4, 6);
  });
});
