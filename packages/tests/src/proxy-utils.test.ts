import { describe, expect, test, vi } from "vitest";
import {
  consumeSseLines,
  findSseBoundary,
  sseDataPayload,
  sseEventPayload,
} from "../../cli/src/lib/sse.js";
import { writeResponsesSse } from "../../cli/src/lib/codex/sse.js";
import { backoffMs, parseRetryAfter } from "../../cli/src/lib/together-retry.js";
import {
  exaSearchBody,
  stringArray,
  trimSearchText,
  webSearchQuery,
} from "../../cli/src/lib/exa-search.js";
import type { ServerResponse } from "node:http";

describe("SSE utilities", () => {
  test.each([
    ["data: one\n\nnext", { index: 9, length: 2 }],
    ["data: one\r\n\r\nnext", { index: 10, length: 3 }],
    ["data: one\n\r\nnext", { index: 9, length: 3 }],
  ])("finds SSE boundary in %j", (buffer, expected) => {
    expect(findSseBoundary(buffer)).toEqual(expected);
  });

  test("finds SSE boundary after an offset", () => {
    const buffer = "prefix\ndata: one\n\ndata: two\n\n";
    expect(findSseBoundary(buffer, "prefix\n".length)).toEqual({ index: 16, length: 2 });
  });

  test("joins multi-line data payloads and ignores non-data fields", () => {
    expect(sseDataPayload("event: message\ndata: first\ndata: second\nid: 1")).toBe(
      "first\nsecond",
    );
    expect(sseEventPayload("event: message\r\ndata: first\r\ndata: second")).toBe("first\nsecond");
    expect(sseDataPayload("event: ping")).toBeUndefined();
  });

  test("consumes complete SSE events and returns the partial tail", () => {
    const payloads: string[] = [];
    const remaining = consumeSseLines(
      "data: first\n\nevent: x\ndata: second\r\n\r\ndata: partial",
      (payload) => payloads.push(payload),
    );

    expect(payloads).toEqual(["first", "second"]);
    expect(remaining).toBe("data: partial");
  });

  test("writes Responses SSE sequence numbers without overwriting explicit values", () => {
    const writes: string[] = [];
    const res = { write: (chunk: string) => writes.push(chunk) } as unknown as ServerResponse;

    writeResponsesSse(res, "response.created", { type: "response.created" });
    writeResponsesSse(res, "response.completed", {
      type: "response.completed",
      sequence_number: 42,
    });

    expect(writes.join("")).toBe(
      [
        'event: response.created\ndata: {"type":"response.created","sequence_number":0}\n\n',
        'event: response.completed\ndata: {"type":"response.completed","sequence_number":42}\n\n',
      ].join(""),
    );
  });
});

describe("Together retry utilities", () => {
  test("parses Retry-After seconds", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  test("parses Retry-After HTTP dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    try {
      expect(parseRetryAfter("Thu, 02 Jul 2026 12:00:05 GMT")).toBe(5000);
      expect(parseRetryAfter("Thu, 02 Jul 2026 11:59:55 GMT")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("uses deterministic exponential backoff with jitter", () => {
    expect(backoffMs(0)).toBe(1200);
    expect(backoffMs(1)).toBe(1600);
    expect(backoffMs(2)).toBe(4800);
  });
});

describe("Exa search utilities", () => {
  test("extracts query strings from supported input shapes", () => {
    expect(webSearchQuery(" latest models ")).toBe("latest models");
    expect(webSearchQuery({ query: " primary " })).toBe("primary");
    expect(webSearchQuery({ q: " fallback " })).toBe("fallback");
    expect(webSearchQuery({ search_query: " codex " })).toBe("codex");
    expect(webSearchQuery({ input: " claude " })).toBe("claude");
    expect(webSearchQuery({ query: "" })).toBe("");
  });

  test("filters domain arrays to non-empty strings", () => {
    expect(stringArray(["exa.ai", "", " together.ai ", 42, null])).toEqual([
      "exa.ai",
      " together.ai ",
    ]);
  });

  test("builds Exa domain filters only when present", () => {
    expect(
      exaSearchBody({
        query: "test",
        allowedDomains: ["together.ai"],
        blockedDomains: ["example.com"],
      }),
    ).toEqual({
      query: "test",
      numResults: 5,
      type: "auto",
      contents: { text: true },
      includeDomains: ["together.ai"],
      excludeDomains: ["example.com"],
    });
    expect(
      exaSearchBody({ query: "test", allowedDomains: [], blockedDomains: [] }),
    ).not.toHaveProperty("includeDomains");
  });

  test("normalizes whitespace and trims snippets", () => {
    expect(trimSearchText("one\n\n two\tthree", 9)).toBe("one two t");
  });
});
