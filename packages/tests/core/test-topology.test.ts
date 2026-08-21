import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..", "..");

describe("test task topology", () => {
  test("keeps deterministic tests cached and live inference explicit", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const testsPackage = readJson(join(root, "packages", "tests", "package.json"));
    const turbo = readJson(join(root, "turbo.json"));
    const defaultConfig = readFileSync(join(root, "packages", "tests", "vitest.config.ts"), "utf8");
    const liveConfig = readFileSync(
      join(root, "packages", "tests", "vitest.live.config.ts"),
      "utf8",
    );

    expect(rootPackage.scripts?.test).toBe("turbo run test --filter='@togetherlink/test-*'");
    expect(rootPackage.scripts?.["test:live"]).toBe(
      "turbo run test:live --filter=@togetherlink/tests",
    );
    expect(testsPackage.scripts?.test).toBe("vitest run --config vitest.config.ts");
    expect(testsPackage.scripts?.["test:live"]).toContain("vitest.live.config.ts");
    expect(
      Object.keys(testsPackage.scripts ?? {}).filter((name) => name.startsWith("test")),
    ).toEqual(["test", "test:live"]);
    expect(turbo.tasks?.test).toBeDefined();
    expect(turbo.tasks?.["test:live"]).toMatchObject({ cache: false });

    const groupRoot = join(root, "packages", "tests");
    const groups = [
      "chatgpt",
      "claude",
      "codex",
      "core",
      "daemon",
      "deepseek",
      "grok",
      "hermes",
      "opencode",
      "pi",
      "prime",
    ];
    for (const group of groups) {
      const groupPackage = readJson(join(groupRoot, group, "package.json"));
      expect(groupPackage.scripts).toEqual({
        test: "vitest run --config ../vitest.group.config.ts",
      });
    }

    for (const file of [
      "Claude.test.ts",
      "Codex.test.ts",
      "Grok.test.ts",
      "OpenCode.test.ts",
      "Pi.test.ts",
      "LiveCodexResume.test.ts",
      "LivePrimeRlm.test.ts",
      "LiveSmoke.test.ts",
      "livemodelscheck.test.ts",
    ]) {
      expect(defaultConfig).toContain(`src/${file}`);
    }
    for (const file of [
      "Claude.test.ts",
      "Codex.test.ts",
      "Grok.test.ts",
      "OpenCode.test.ts",
      "Pi.test.ts",
      "LivePrimeRlm.test.ts",
    ]) {
      expect(liveConfig).toContain(`src/${file}`);
    }
  });
});

function readJson(path: string): {
  scripts?: Record<string, string>;
  tasks?: Record<string, { cache?: boolean }>;
} {
  return JSON.parse(readFileSync(path, "utf8"));
}
