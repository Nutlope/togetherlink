import { describe, expect, test } from "vitest";
import { resolveHarnessInvocation } from "../../cli/src/lib/commands/harness-invocation.js";
import { parseArgs } from "../../cli/src/lib/parse-args.js";

describe("harness invocation parsing", () => {
  test("parses the usage reporting window", () => {
    const parsed = parseArgs(["usage", "--last", "7d"]);

    expect(parsed.positional).toEqual(["usage"]);
    expect(parsed.flags.last).toBe("7d");
  });

  test("forwards harness flags as real CLI args", () => {
    const parsed = parseArgs(["claude", "--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual([
      "--resume",
      "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d",
    ]);
  });

  test("strips the passthrough separator before launching the native harness", () => {
    const parsed = parseArgs(["claude", "--", "--print", "Reply with exactly: hi"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["--print", "Reply with exactly: hi"]);
    expect(invocation.flags.passthroughSeparator).toBe(true);
  });

  test("does not reserve run after a harness", () => {
    const parsed = parseArgs(["claude", "run", "--resume", "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual([
      "run",
      "--resume",
      "8616d14d-f3a7-4ee3-bfc3-34bce6602b8d",
    ]);
  });

  test("passes native status through when the separator is present", () => {
    const parsed = parseArgs(["claude", "--", "status"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["status"]);
    expect(invocation.flags.passthroughSeparator).toBe(true);
  });

  test("passes status through like any other native argument", () => {
    const parsed = parseArgs(["claude", "status"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("claude");
    expect(invocation.flags.passthrough).toEqual(["status"]);
    expect(invocation.flags.passthroughSeparator).toBeUndefined();
  });

  test("keeps togetherlink flags before the harness", () => {
    const parsed = parseArgs([
      "--main",
      "together-kimi-k2-7-code",
      "claude",
      "--resume",
      "session-id",
    ]);
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

  test("parses codex-app model and restore flags before dispatch", () => {
    const parsed = parseArgs(["codex-app", "--model", "zai-org/GLM-5.2", "--restore"]);

    expect(parsed.positional).toEqual(["codex-app"]);
    expect(parsed.flags.main).toBe("zai-org/GLM-5.2");
    expect(parsed.flags.restore).toBe(true);
  });

  test("parses off after a harness as a togetherlink verb, not passthrough", () => {
    const parsed = parseArgs(["codex", "off"]);

    expect(parsed.positional).toEqual(["codex", "off"]);
    expect(parsed.flags.passthrough).toEqual([]);
  });

  test("parses restore after a harness as a togetherlink verb, not passthrough", () => {
    const parsed = parseArgs(["codex", "restore"]);

    expect(parsed.positional).toEqual(["codex", "restore"]);
    expect(parsed.flags.passthrough).toEqual([]);
  });

  test("keeps harness passthrough after the off/restore verb", () => {
    const parsed = parseArgs(["codex", "off", "--flag-for-codex"]);

    expect(parsed.positional).toEqual(["codex", "off"]);
    expect(parsed.flags.passthrough).toEqual(["--flag-for-codex"]);
  });

  test("still forwards a literal off after the passthrough separator", () => {
    const parsed = parseArgs(["codex", "--", "off"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("codex");
    expect(invocation.flags.passthrough).toEqual(["off"]);
    expect(invocation.flags.passthroughSeparator).toBe(true);
  });

  test("keeps off positional for chatgpt, which is not a harness token", () => {
    const parsed = parseArgs(["chatgpt", "off"]);

    expect(parsed.positional).toEqual(["chatgpt", "off"]);
    expect(parsed.flags.passthrough).toBeUndefined();
  });

  test("forwards Grok headless flags to the native CLI", () => {
    const parsed = parseArgs(["grok", "--", "--output-format", "streaming-json", "-p", "hi"]);
    const invocation = resolveHarnessInvocation(parsed.positional, parsed.flags);

    expect(invocation.command).toBe("grok");
    expect(invocation.flags.passthrough).toEqual(["--output-format", "streaming-json", "-p", "hi"]);
  });
});
