import { type ServerResponse } from "node:http";
import { writeJson } from "../http-util.js";
import { TOGETHER_BASE_URL } from "../together-core.js";
import { writeProxyDebugLog } from "../proxy-debug.js";
import { backoffMs, parseRetryAfter, sleep } from "../together-retry.js";
import type { OpenAIChatResponse, TogetherApiError, TogetherFetchResult } from "./wire-types.js";

type TogetherCallOptions = {
  apiKey: string;
  debug?: boolean | undefined;
};

// Transient upstream faults worth retrying with backoff. 429 = rate limited;
// 503/overloaded = server-side temporary capacity. Everything else (401, 400,
// 402, 404, 5xx other than 503) is non-retryable — retrying a bad key or a
// malformed request just delays the same failure.
const RETRYABLE_STATUSES = new Set([429, 503]);
const RETRYABLE_ERROR_CODES = new Set(["overloaded", "service_unavailable"]);
const MAX_RETRIES = 3;

/**
 * POST to Together with automatic retry for transient faults (429 / 503 /
 * overloaded). On a non-retryable status, or after MAX_RETRIES retries, returns
 * `{ ok: false, error }` carrying the mapped Anthropic error shape — the caller
 * throws it to surface an honest error instead of flattening to 500.
 *
 * Backoff honors `Retry-After` when Together sends it (seconds or HTTP-date),
 * else exponential 1s → 2s → 4s with up to ±25% jitter. Deterministic jitter is
 * derived from the attempt index so the same call retraces the same waits
 * (Math.random would break workflow resume determinism).
 */
export async function fetchTogether(
  payload: Record<string, unknown>,
  options: TogetherCallOptions,
  signal?: AbortSignal,
): Promise<TogetherFetchResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${TOGETHER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        ...(signal ? { signal } : {}),
      });
    } catch (err) {
      // Network-level failure (DNS, connection reset, timeout). Treat as
      // retryable transient — the request never reached Together, so it's
      // safe to try again. If it keeps failing, surface as overloaded_error.
      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return {
        ok: false,
        error: {
          status: 0,
          anthropicStatus: 503,
          anthropicType: "overloaded_error",
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        },
      };
    }

    if (response.ok) {
      return { ok: true, json: (await response.json()) as OpenAIChatResponse };
    }

    const error = await mapTogetherError(response);
    debugLog(options, "together error", {
      status: error.status,
      anthropicType: error.anthropicType,
      code: error.code,
      retryable: error.retryable,
      attempt,
      body: error.message.slice(0, 1000),
    });

    if (!error.retryable || attempt >= MAX_RETRIES) {
      return { ok: false, error };
    }
    await sleep(error.retryAfterMs ?? backoffMs(attempt));
  }
  // Unreachable: loop returns on every path. Satisfies exhaustiveness.
  return {
    ok: false,
    error: {
      status: 0,
      anthropicStatus: 500,
      anthropicType: "api_error",
      message: "Together request failed after retries.",
      retryable: false,
    },
  };
}

/**
 * Read a non-OK Together response and normalize it into a TogetherApiError with
 * the mapped Anthropic error type. Pulls the human message and code from
 * Together's `error` object (it nests message under `error.message` for
 * validation errors, and as a string for auth errors).
 */
export async function mapTogetherError(response: Response): Promise<TogetherApiError> {
  const raw = await response.text();
  let code: string | undefined;
  let message = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        message?: string | { message?: string; type?: string; code?: string };
        type?: string;
        code?: string;
      };
    };
    const err = parsed.error;
    if (err) {
      code = err.code ?? (typeof err.message === "object" ? err.message.code : undefined);
      const msg =
        typeof err.message === "object"
          ? err.message.message
          : typeof err.message === "string"
            ? err.message
            : undefined;
      message = msg ?? err.type ?? message;
    }
  } catch {
    // Keep the raw slice as the message if the body wasn't JSON.
  }

  const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
  const retryable =
    RETRYABLE_STATUSES.has(response.status) ||
    (typeof code === "string" && RETRYABLE_ERROR_CODES.has(code));

  const mapped = mapStatusToAnthropicError(response.status);
  return {
    status: response.status,
    anthropicStatus: mapped.status,
    anthropicType: mapped.type,
    message: `Together API returned ${response.status}: ${message}`,
    code,
    retryAfterMs,
    retryable,
  };
}

/**
 * Map an upstream HTTP status to the Anthropic error shape Claude Code knows how
 * to render (the binary recognizes api_error, authentication_error,
 * rate_limit_error, invalid_request_error, overloaded_error, not_found_error,
 * permission_error, billing_error, timeout_error). Defaults to api_error.
 */
function mapStatusToAnthropicError(status: number): { status: number; type: string } {
  switch (status) {
    case 400:
      return { status: 400, type: "invalid_request_error" };
    case 401:
      return { status: 401, type: "authentication_error" };
    case 402:
      return { status: 402, type: "billing_error" };
    case 403:
      return { status: 403, type: "permission_error" };
    case 404:
      return { status: 404, type: "not_found_error" };
    case 408:
      return { status: 408, type: "timeout_error" };
    case 429:
      return { status: 429, type: "rate_limit_error" };
    case 503:
      return { status: 503, type: "overloaded_error" };
    case 500:
    case 502:
    case 504:
      return { status: 500, type: "api_error" };
    default:
      return { status: status || 500, type: "api_error" };
  }
}

export function writeAnthropicError(
  res: ServerResponse,
  status: number,
  type: string,
  message: string,
): void {
  writeJson(res, status, {
    type: "error",
    error: { type, message },
  });
}

/** Whether a thrown value is a normalized Together upstream error. */
export function isTogetherApiError(value: unknown): value is TogetherApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "anthropicType" in value &&
    "anthropicStatus" in value &&
    "retryable" in value
  );
}

function debugLog(
  options: TogetherCallOptions,
  label: string,
  value: unknown | (() => unknown),
): void {
  writeProxyDebugLog("togetherlink proxy", options, label, value);
}
