import { describe, expect, test } from "vitest";
import { codexExecArgs } from "./codex-exec.js";

describe("codexExecArgs", () => {
  test("keeps text-only Codex probes sandboxed by default", () => {
    expect(codexExecArgs("say hi")).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  test("bypasses Codex sandboxing for controlled local tool probes", () => {
    const args = codexExecArgs("read a file", { allowLocalTools: true });

    expect(args).toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args).not.toContain("--sandbox");
  });

  test("places extra Codex options before the prompt", () => {
    const args = codexExecArgs("answer", { extraArgs: ["-c", 'model_reasoning_effort="high"'] });

    expect(args.slice(-3)).toEqual(["-c", 'model_reasoning_effort="high"', "answer"]);
  });
});
