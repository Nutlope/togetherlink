import os from "node:os";
import { ALL_HARNESSES, HARNESS_LABEL, type HarnessId } from "../harness.js";
import { loadHarness, isHarnessImplemented } from "../harness-registry.js";
import type { HarnessContext, HarnessResult } from "../harness-types.js";

const VALID_VERBS = new Set(["on", "off", "status"]);
type HarnessVerb = "on" | "off" | "status";

export async function dispatchHarnessCommand(
  harnessName: string,
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
  const resolvedVerb = verb ?? "on"; // bare harness name defaults to `on`
  if (!isHarnessVerb(resolvedVerb)) {
    throw new Error(`Unknown command "${harnessName} ${verb}". Expected: on, off, status.`);
  }

  const harnessModule = await loadHarness(harnessName);
  const ctx = { home: os.homedir(), ...flags };
  const result = await harnessModule[resolvedVerb](ctx);
  renderResult(result, flags);
}

function isKnownHarness(value: string): value is HarnessId {
  return (ALL_HARNESSES as readonly string[]).includes(value);
}

function isHarnessVerb(value: string): value is HarnessVerb {
  return VALID_VERBS.has(value);
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
