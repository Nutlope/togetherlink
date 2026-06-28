import { afterAll, beforeAll, describe, test } from "vitest";
import { runCommand } from "./command.js";
import { cleanupTmpDir, createTestContext, resetTmpDir } from "./context.js";
import { claudeScenarios } from "./harnesses/claude.js";
import { codexScenarios } from "./harnesses/codex.js";
import { opencodeScenarios } from "./harnesses/opencode.js";
import { piScenarios } from "./harnesses/pi.js";
import type { Scenario, TestContext } from "./types.js";

const maybeDescribe = process.env.TOGETHERLINK_LIVE_SMOKE === "1" ? describe : describe.skip;

maybeDescribe("live headless harness smoke", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    await resetTmpDir(context);
    await stopDaemon(context, "live-smoke-daemon-stop-before");
  });

  afterAll(async () => {
    if (context) {
      await stopDaemon(context, "live-smoke-daemon-stop-after");
      await cleanupTmpDir(context);
    }
  });

  for (const scenario of smokeScenarios()) {
    test(scenario.name, async () => {
      await scenario.run(context);
    });
  }
});

function smokeScenarios(): Scenario[] {
  return [
    ...pickScenarios(codexScenarios(), [
      "codex: basic headless response",
      "codex: bash tool call",
    ]),
    ...pickScenarios(claudeScenarios(), [
      "claude: basic headless response",
      "claude: read tool call",
    ]),
    ...pickScenarios(opencodeScenarios(), [
      "opencode: basic streaming headless response",
      "opencode: bash tool call",
    ]),
    ...pickScenarios(piScenarios(), [
      "pi: basic streaming json response with cost",
      "pi: bash tool call with cost",
    ]),
  ];
}

function pickScenarios(scenarios: Scenario[], names: string[]): Scenario[] {
  return names.map((name) => {
    const scenario = scenarios.find((candidate) => candidate.name === name);
    if (!scenario) {
      throw new Error(`Missing live smoke scenario: ${name}`);
    }
    return scenario;
  });
}

async function stopDaemon(context: TestContext, artifactName: string): Promise<void> {
  await runCommand(context, artifactName, process.execPath, [
    context.cliBin,
    "daemon",
    "stop",
  ], { timeoutMs: 20_000 });
}
