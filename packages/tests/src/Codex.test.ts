import { afterAll, beforeAll, describe, test } from "vitest";
import { createTestContext, resetTmpDir } from "./context.js";
import { codexScenarios } from "./harnesses/codex.js";
import type { TestContext } from "./types.js";

describe("Codex live headless gauntlet", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
  });

  afterAll(async () => {
    await resetTmpDir(context);
  });

  for (const scenario of codexScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});
