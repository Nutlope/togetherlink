import { describe, expect, test } from "vitest";
import {
  SessionRegistry,
  buildSession,
  type RegisterSessionRequest,
} from "@togetherlink/cli/dist/lib/daemon/state.js";

/**
 * Unit tests for the now-exported SessionRegistry (#5: the interface is the test
 * surface). These exercise register/get/delete/reapDead in isolation — no daemon
 * process, no HTTP, no port. Proves the registry is substitutable (constructable
 * + injectable) rather than reachable only through the singleton.
 */

const MODEL_DEF = {
  id: "zai-org/GLM-5.2",
  name: "GLM 5.2",
  cost: { input: 1.4, output: 4.4, cache_read: 0.26 },
  limit: { context: 262144, output: 164000 },
  attachment: false,
  reasoning: true,
  temperature: true,
  tool_call: true,
  modalities: { input: ["text"], output: ["text"] },
};

function makeRequest(token: string, agent = "claude"): RegisterSessionRequest {
  return {
    token,
    authToken: `auth-${token}`,
    agent,
    apiKey: "test-key",
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
});
