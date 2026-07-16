import { afterAll, beforeAll, describe, test } from "vitest";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { grokScenarios } from "./harnesses/grok.js";
import type { TestContext } from "./types.js";

describe("Grok Build live headless gauntlet", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    await cleanupTmpDir(context);
  });

  for (const scenario of grokScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});
