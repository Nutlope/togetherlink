import { TOGETHER_BASE_URL } from "./together-core.js";
import { backoffMs, parseRetryAfter, sleep } from "./together-retry.js";

/**
 * The deep Together HTTP client — one place for the POST /chat/completions
 * retry loop that used to be copy-pasted three times (claude/together-call.ts,
 * claude/stream.ts:postTogetherStream, codex/together-call.ts). Carved out so
 * `together-core.ts`'s name finally earns its keep: the retry contract
 * (429/503 + Retry-After + exponential backoff, serialize-once) lives here
 * behind a small interface, testable through one seam instead of three.
 *
 * Returns the raw `Response`. Each harness applies its own error-shape mapping
 * (Anthropic vs OpenAI Responses) on top — keeping the error contract where
 * the wire format lives, not here.
 */

// Transient upstream faults worth retrying. 429 = rate limited; 503 = temporary
// capacity. Everything else (401, 400, 402, 404, 5xx other than 503) is
// non-retryable — retrying a bad key or a malformed request just delays the
// same failure.
const RETRYABLE_STATUSES = new Set([429, 503]);

export const MAX_RETRIES = 3;

export type TogetherClientOptions = {
  apiKey: string;
  debug?: boolean | undefined;
};

/**
 * POST /chat/completions with automatic retry for transient faults (429/503).
 * Serializes the body exactly once and resends the identical bytes on every
 * retry (the payload is never mutated within this loop). Honors `Retry-After`
 * when present, else exponential 1s→2s→4s with deterministic jitter.
 *
 * Returns the final `Response` (whatever status it ended on). The caller is
 * responsible for reading the body and mapping errors to its wire format.
 */
export async function postChatCompletion(
  payload: Record<string, unknown>,
  options: TogetherClientOptions,
  signal?: AbortSignal,
): Promise<Response> {
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      // Network-level failure (DNS, connection reset, timeout). The request
      // never reached Together, so it's safe to retry. After MAX_RETRIES,
      // synthesize a 503 Response so the caller's error mapping sees a
      // consistent shape.
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return syntheticOverloadedResponse(err instanceof Error ? err.message : String(err));
    }

    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt >= MAX_RETRIES) {
      return response;
    }
    // Drain the retryable response body before sleeping (the body is small for
    // 429/503 and we must not leak the stream).
    await response.arrayBuffer().catch(() => undefined);
    await sleep(parseRetryAfter(response.headers.get("retry-after")) ?? backoffMs(attempt));
  }
  // Unreachable: the loop returns on every path. Defensive fallback.
  return syntheticOverloadedResponse("Together request failed after retries.");
}

/**
 * POST /chat/completions as a streaming request, with no 429/503 retry at this
 * layer (the stream retry logic lives in the harness-specific native-tool loops,
 * which need to re-serialize after payload mutation). Kept here so the URL +
 * headers + auth live in one place, not three.
 *
 * `body` lets callers that have already serialized the payload (e.g. the
 * max_tokens-clamp retry path) resend identical bytes.
 */
export async function postChatCompletionStream(
  payload: Record<string, unknown>,
  options: TogetherClientOptions,
  signal?: AbortSignal,
  body?: string,
): Promise<Response> {
  return await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ?? JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
}

function syntheticOverloadedResponse(message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

/** Whether a given HTTP status is in the retryable set (429/503). Exposed for
 * callers that need to decide whether to retry without re-issuing the fetch. */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}
