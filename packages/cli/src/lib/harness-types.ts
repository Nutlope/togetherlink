import type { HarnessId } from "./harness.js";

export type HarnessContext = {
  home: string;
  apiKey?: string;
  apiKeyFromFlag?: boolean;
  main?: string;
  passthrough?: string[];
  json?: boolean;
  search?: string;
  slot?: string;
};

export type HarnessResult = {
  message?: string;
  payload?: Record<string, unknown>;
};

export type Harness = {
  id: HarnessId;
  label: string;
  mode?: "persistent" | "ephemeral";
  resolveKey?: (ctx: HarnessContext) => Promise<string>;
  run?: (ctx: HarnessContext) => Promise<HarnessResult>;
  on?: (ctx: HarnessContext) => Promise<HarnessResult>;
  off?: (ctx: HarnessContext) => Promise<HarnessResult>;
  status: (ctx: HarnessContext) => Promise<HarnessResult>;
};

/**
 * Defines a harness adapter. Throws early (at module load) if a harness is
 * missing a required method, rather than failing confusingly at dispatch
 * time.
 */
export function defineHarness(impl: Harness): Harness {
  if (typeof impl.status !== "function") {
    throw new Error(`Harness "${impl.id}" is missing required method "status"`);
  }
  if (!impl.run && !impl.on) {
    throw new Error(`Harness "${impl.id}" must define either "run" or "on"`);
  }
  return impl;
}
