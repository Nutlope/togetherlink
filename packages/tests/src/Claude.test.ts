import { afterAll, beforeAll, describe, test } from "vitest";
import { createTestContext, resetTmpDir } from "./context.js";
import { claudeScenarios } from "./harnesses/claude.js";
import type { TestContext } from "./types.js";

describe("Claude live headless gauntlet", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    await resetTmpDir(context);
  });

  for (const scenario of claudeScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});
