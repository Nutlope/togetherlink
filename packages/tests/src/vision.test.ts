import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, test, vi } from "vitest";
import { describeImage } from "../../cli/src/lib/claude/vision.js";

describe("Claude vision description", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("keeps successful primary vision calls single-request by default", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requests.push(modelFromBody(init));
        await sleep(20);
        return visionResponse("primary description");
      }),
    );

    const started = performance.now();
    const result = await describeImage(testImage(), {
      apiKey: "test-key",
      baseUrl: "https://api.together.ai/v1",
    });
    const elapsedMs = performance.now() - started;

    expect(result.description).toBe("primary description");
    expect(requests).toHaveLength(1);
    expect(elapsedMs).toBeGreaterThanOrEqual(18);
  });

  test("can race fallback vision model after an opt-in delay", async () => {
    vi.stubEnv("TOGETHERLINK_VISION_FAILOVER_RACE_DELAY_MS", "5");
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const model = modelFromBody(init);
        requests.push(model);
        if (requests.length === 1) {
          await sleep(40);
          return visionResponse("slow primary description");
        }
        await sleep(5);
        return visionResponse("fast fallback description");
      }),
    );

    const started = performance.now();
    const result = await describeImage(testImage(), {
      apiKey: "test-key",
      baseUrl: "https://api.together.ai/v1",
    });
    const elapsedMs = performance.now() - started;

    expect(result.description).toBe("fast fallback description");
    expect(requests).toHaveLength(2);
    expect(elapsedMs).toBeLessThan(30);
  });

  test("uses the session upstream base URL for direct vision requests", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return visionResponse("proxied vision description");
      }),
    );

    await describeImage(testImage(), {
      apiKey: "test-key",
      baseUrl: "http://vision-upstream.test/together/v1",
    });

    expect(urls).toEqual(["http://vision-upstream.test/together/v1/chat/completions"]);
  });

  test("bounds vision requests that never return response headers", async () => {
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_TIMEOUT_MS", "100");
    vi.stubEnv("TOGETHERLINK_RESPONSE_HEADER_RETRIES", "0");
    vi.stubEnv("TOGETHERLINK_REQUEST_DIAGNOSTICS", "0");
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await describeImage(testImage(), {
      apiKey: "test-key",
      baseUrl: "http://vision-upstream.test/together/v1",
    });

    expect(result.description).toContain("all vision models failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function testImage() {
  return {
    type: "image" as const,
    source: {
      type: "base64",
      media_type: "image/png",
      data: "abc123",
    },
  };
}

function visionResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function modelFromBody(init?: RequestInit): string {
  const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
  return body.model ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
