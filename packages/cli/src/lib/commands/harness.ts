import os from "node:os";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { loadHarness, isHarnessImplemented } from "../harness-registry.js";
import { detectInstalledHarness, missingHarnessMessage } from "../detect.js";
import type { HarnessContext, HarnessResult } from "../harness-types.js";

export async function dispatchHarnessCommand(
  harnessName: string | undefined,
  verb: string | undefined,
  flags: Partial<HarnessContext>,
): Promise<void> {
  if (!isKnownHarness(harnessName)) {
    throw new Error(`Unknown harness "${harnessName}". Expected one of: ${ALL_HARNESSES.join(", ")}`);
  }
  if (!isHarnessImplemented(harnessName)) {
    throw new Error(
      `${HARNESS_LABEL[harnessName]} support isn't built yet (coming in a later phase — it needs a local translation proxy).`,
    );
  }
  const harnessModule = await loadHarness(harnessName);
  if (verb !== undefined && verb !== "run") {
    throw new Error(`Unknown command "${harnessName} ${verb}". Expected: run.`);
  }
  if (!detectInstalledHarness(harnessName).installed) {
    throw new Error(missingHarnessMessage(harnessName));
  }

  const ctx = { home: os.homedir(), ...flags };
  const result = await harnessModule.run(ctx);
  renderResult(result, flags);
}

function isKnownHarness(value: string | undefined): value is HarnessId {
  return value !== undefined && (ALL_HARNESSES as readonly string[]).includes(value);
}

function renderResult(result: HarnessResult, flags: Partial<HarnessContext>): void {
  if (!result) {
    return;
  }
  if (result.message) {
    console.log(result.message);
  }
  if (result.payload) {
    if (flags.json) {
      console.log(JSON.stringify(result.payload, null, 2));
    } else {
      for (const [key, value] of Object.entries(result.payload)) {
        console.log(`${key}: ${value ?? "(unset)"}`);
      }
    }
  }
}
