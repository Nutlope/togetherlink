import { afterEach, describe, expect, test, vi } from "vitest";
import { GLM_5_2 } from "@togetherlink/models";
import { fetchTogether } from "@togetherlink/cli/dist/lib/claude/together-call.js";

/**
 * Characterization tests for the Together HTTP retry loop (#1 prep). These lock
 * in the current retry contract — 429/503 retry with backoff, 401/400 no retry,
 * network failure retries then surfaces overloaded_error — so the extraction
 * of a shared Together client (#1) can't silently change it. Uses a mocked
 * global fetch; no network calls.
 *
 * Note: the retry loop sleeps real backoff (1s→2s→4s, from together-retry.ts).
 * Tests that exercise retries therefore take a few seconds; we accept that for
 * a characterization test that guards a real contract.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function togetherOptions(apiKey = "k") {
  return { apiKey, baseUrl: "https://together.test/v1" };
}

describe("claude/together-call.ts fetchTogether retry contract (#1 characterization)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("200 OK returns the JSON body, no retry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: "chatcmpl-1", choices: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchTogether({ model: "x" }, togetherOptions(), GLM_5_2);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("429 then 200: retries once and succeeds", async () => {
    const seq = [
      jsonResponse(429, { error: { message: "slow down" } }),
      jsonResponse(200, { id: "ok", choices: [] }),
    ];
    let i = 0;
    vi.stubGlobal("fetch", async () => seq[i++] ?? seq[seq.length - 1]);
    const result = await fetchTogether({ model: "x" }, togetherOptions(), GLM_5_2);
    expect(result.ok).toBe(true);
    expect(i).toBe(2); // one 429, then one 200
  });

  test("401 does NOT retry — non-retryable surfaces immediately", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: { message: "bad key" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchTogether({ model: "x" }, togetherOptions("bad"), GLM_5_2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(401);
      expect(result.error.retryable).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("503 is retryable (the set includes 503)", async () => {
    // A single 503 then 200 proves 503 is in the retryable set.
    const seq = [
      jsonResponse(503, { error: { message: "temp" } }),
      jsonResponse(200, { id: "ok", choices: [] }),
    ];
    let i = 0;
    vi.stubGlobal("fetch", async () => seq[i++] ?? seq[seq.length - 1]);
    const result = await fetchTogether({ model: "x" }, togetherOptions(), GLM_5_2);
    expect(result.ok).toBe(true);
    expect(i).toBe(2);
  });

  test("network failure (fetch throws) retries then surfaces overloaded_error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchTogether({ model: "x" }, togetherOptions(), GLM_5_2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.anthropicType).toBe("overloaded_error");
      expect(result.error.anthropicStatus).toBe(503);
    }
    // 1 initial + 3 retries = 4 attempts (MAX_RETRIES = 3).
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
