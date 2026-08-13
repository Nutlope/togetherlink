import { describe, expect, test } from "vitest";
import { interactiveLauncherOptions } from "../../cli/src/lib/interactive-launcher-options.js";

describe("interactive launcher options", () => {
  test("shows only the common choices until the user asks for more", () => {
    expect(interactiveLauncherOptions().map(({ value }) => value)).toEqual([
      "chatgpt",
      "claude",
      "codex",
      "opencode",
      "pi",
      "configure",
      "show-more",
    ]);
  });

  test("expands to include every less common harness", () => {
    expect(interactiveLauncherOptions(true).map(({ value }) => value)).toEqual([
      "chatgpt",
      "claude",
      "codex",
      "opencode",
      "pi",
      "deepseek",
      "grok",
      "hermes",
      "prime",
      "configure",
    ]);
  });
});
