import { afterAll, beforeAll, describe, test } from "vitest";
import { createTestContext, resetTmpDir } from "./context.js";
import { piScenarios } from "./harnesses/pi.js";
import type { TestContext } from "./types.js";

describe("Pi Code live headless gauntlet", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    await resetTmpDir(context);
  });

  for (const scenario of piScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});
