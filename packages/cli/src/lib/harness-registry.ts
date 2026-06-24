import { HARNESS, type HarnessId } from "./harness.js";
import type { Harness } from "./harness-types.js";

const LOADERS: Partial<Record<HarnessId, () => Promise<{ default: Harness }>>> = {
  [HARNESS.CLAUDE]: () => import("./harnesses/claude.js"),
  [HARNESS.CODEX]: () => import("./harnesses/codex.js"),
  [HARNESS.OPENCODE]: () => import("./harnesses/opencode.js"),
};

export async function loadHarness(harness: HarnessId): Promise<Harness> {
  const loader = LOADERS[harness];
  if (!loader) {
    throw new Error(`Harness "${harness}" is not implemented yet.`);
  }
  const mod = await loader();
  return mod.default;
}

export function isHarnessImplemented(harness: HarnessId): boolean {
  return harness in LOADERS;
}
