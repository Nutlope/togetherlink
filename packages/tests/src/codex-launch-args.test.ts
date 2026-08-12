import { describe, expect, test } from "vitest";
import { buildCodexLaunchArgs } from "../../cli/src/lib/codex/core.js";

describe("Codex launch arguments", () => {
  test("inserts TogetherLink config before a native passthrough separator", () => {
    const args = buildCodexLaunchArgs({
      args: [
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        "--json",
        "--",
        "--model",
        "arbitrary prompt text",
      ],
      proxyUrl: "http://127.0.0.1:4242/session/token",
      authToken: "unused-local-token",
      modelId: "moonshotai/Kimi-K3",
      catalogPath: "/tmp/models.json",
    });

    const separatorIndex = args.indexOf("--");
    expect(separatorIndex).toBeGreaterThan(0);
    expect(args.slice(separatorIndex + 1)).toEqual(["--model", "arbitrary prompt text"]);
    expect(args.indexOf("-c")).toBeLessThan(separatorIndex);
    expect(args).toContain('model="moonshotai/Kimi-K3"');
  });
});
