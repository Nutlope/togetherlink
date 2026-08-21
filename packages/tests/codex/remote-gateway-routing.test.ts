import { describe, expect, test } from "vitest";
import { shouldForwardCodexRequestToRemoteGateway } from "../../cli/src/lib/remote-gateway.js";

describe("Codex remote gateway routing", () => {
  test("keeps ordinary Responses turns on the hosted router", () => {
    expect(
      shouldForwardCodexRequestToRemoteGateway({
        method: "POST",
        url: "/v1/responses",
        headers: {},
      }),
    ).toBe(true);
  });

  test("keeps marked memory-generation turns on the local memory proxy", () => {
    expect(
      shouldForwardCodexRequestToRemoteGateway({
        method: "POST",
        url: "/v1/responses",
        headers: { "x-openai-memgen-request": "memory-request-123" },
      }),
    ).toBe(false);
  });

  test("keeps the dedicated memory-summary endpoint on the local memory proxy", () => {
    expect(
      shouldForwardCodexRequestToRemoteGateway({
        method: "POST",
        url: "/v1/memories/trace_summarize",
        headers: {},
      }),
    ).toBe(false);
  });
});
