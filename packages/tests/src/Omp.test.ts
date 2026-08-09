import { afterAll, beforeAll, describe, test } from "vitest";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { ompScenarios } from "./harnesses/omp.js";
import type { TestContext } from "./types.js";

describe("Oh My Pi live headless gauntlet", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    await cleanupTmpDir(context);
  });

  for (const scenario of ompScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});
