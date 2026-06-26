import { describe, expect, test } from "vitest";
import { resolveHarnessInvocation } from "../../cli/src/lib/commands/harness-invocation.js";
import { parseArgs } from "../../cli/src/lib/parse-args.js";

describe("harness invocation parsing", () => {
  test("forwards harness flags as real CLI args", () => {
    const parsed = parseArgs(["claude", "--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
  });

  test("does not reserve run after a harness", () => {
    const parsed = parseArgs(["claude", "run", "--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["run", "--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
  });

  test("does not reserve status after a harness", () => {
    const parsed = parseArgs(["claude", "status"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["status"]);
  });

  test("keeps togetherlink flags before the harness", () => {
    const parsed = parseArgs(["--main", "together-kimi-k2-7-code", "claude", "--resume", "session-id"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.main).toBe("together-kimi-k2-7-code");
    expect(invocation.flags.passthrough).toEqual(["--resume", "session-id"]);
  });

  test("passes known togetherlink flags through after the harness", () => {
    const parsed = parseArgs(["claude", "--main", "real-claude-value"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.main).toBeUndefined();
    expect(invocation.flags.passthrough).toEqual(["--main", "real-claude-value"]);
  });
});
