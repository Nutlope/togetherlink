import { describe, expect, test } from "vitest";
import { type ServerResponse } from "node:http";
import { renderDaemonError } from "@togetherlink/cli/dist/lib/daemon/server.js";
import type { TogetherApiError } from "@togetherlink/cli/dist/lib/claude/wire-types.js";

// A minimal ServerResponse stub: capture statusCode + the JSON body written.
function mockRes(): { res: ServerResponse; statusCode: number | undefined; body: string } {
  const state = { statusCode: undefined as number | undefined, body: "" };
  const res = {
    writeHead: (status: number, _headers?: Record<string, string>) => {
      state.statusCode = status;
    },
    end: (chunk?: unknown) => {
      state.body = typeof chunk === "string" ? chunk : String(chunk ?? "");
    },
    setHeader: () => {},
  } as unknown as ServerResponse;
  return {
    res,
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
  };
}

// Construct a TogetherApiError the way claude/together-call.ts does — the
// Anthropic-shaped error the catch-all used to handle exclusively.
function anthropicError(status: number, type: string, message: string): TogetherApiError {
  return {
    status,
    anthropicStatus: status,
    anthropicType: type,
    message,
    code: undefined,
    retryAfterMs: undefined,
    retryable: false,
  };
}

describe("daemon error rendering (#2 — error contract at the seam)", () => {
  test("Claude agent + Anthropic error → Anthropic error shape", () => {
    const m = mockRes();
    renderDaemonError(m.res, anthropicError(429, "rate_limit_error", "slow down"), "claude");
    expect(m.statusCode).toBe(429);
    const parsed = JSON.parse(m.body);
    expect(parsed.type).toBe("error");
    expect(parsed.error.type).toBe("rate_limit_error");
    expect(parsed.error.message).toBe("slow down");
  });

  test("Claude agent + plain Error → Anthropic 500 api_error", () => {
    const m = mockRes();
    renderDaemonError(m.res, new Error("boom"), "claude");
    expect(m.statusCode).toBe(500);
    const parsed = JSON.parse(m.body);
    expect(parsed.type).toBe("error");
    expect(parsed.error.type).toBe("api_error");
    expect(parsed.error.message).toBe("boom");
  });

  test("Codex agent + Anthropic-shaped error → OpenAI error shape (the bug fix)", () => {
    const m = mockRes();
    // Before the fix: Codex threw plain Error, isTogetherApiError never matched,
    // and the client got an Anthropic-shaped error despite speaking the
    // Responses API. After the fix: codex agent renders the OpenAI shape.
    renderDaemonError(m.res, anthropicError(429, "rate_limit_error", "slow down"), "codex");
    expect(m.statusCode).toBe(429);
    const parsed = JSON.parse(m.body);
    // OpenAI error shape is { error: { type, message } } — NOT the Anthropic
    // { type: "error", error: { ... } } envelope.
    expect(parsed.error).toBeTypeOf("object");
    expect(parsed.error.type).toBe("rate_limit_error");
    expect(parsed.error.message).toBe("slow down");
    expect(parsed.type).toBeUndefined();
  });

  test("Codex-app agent + plain Error → OpenAI error shape", () => {
    const m = mockRes();
    renderDaemonError(m.res, new Error("codex boom"), "codex-app");
    expect(m.statusCode).toBe(500);
    const parsed = JSON.parse(m.body);
    expect(parsed.error.type).toBe("api_error");
    expect(parsed.error.message).toBe("codex boom");
    expect(parsed.type).toBeUndefined();
  });

  test("Unknown agent defaults to Anthropic shape (no regression to Claude path)", () => {
    const m = mockRes();
    renderDaemonError(m.res, new Error("unknown agent"), undefined);
    expect(m.statusCode).toBe(500);
    const parsed = JSON.parse(m.body);
    expect(parsed.type).toBe("error");
    expect(parsed.error.type).toBe("api_error");
  });

  test("Non-Error thrown value is stringified, not crashed", () => {
    const m = mockRes();
    renderDaemonError(m.res, "a bare string", "codex");
    expect(m.statusCode).toBe(500);
    const parsed = JSON.parse(m.body);
    expect(parsed.error.message).toBe("a bare string");
  });
});
