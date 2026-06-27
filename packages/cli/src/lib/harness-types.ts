import type { HarnessId } from "./harness.js";

export type HarnessContext = {
  home: string;
  apiKey?: string;
  apiKeyFromFlag?: boolean;
  main?: string;
  passthrough?: string[];
  json?: boolean;
  restore?: boolean;
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
  run: (ctx: HarnessContext) => Promise<HarnessResult>;
  status: (ctx: HarnessContext) => Promise<HarnessResult>;
};

/**
 * Defines a harness adapter. Throws early (at module load) if a harness is
 * missing a required method, rather than failing confusingly at dispatch
 * time.
 */
export function defineHarness(impl: Harness): Harness {
  if (typeof impl.run !== "function") {
    throw new Error(`Harness "${impl.id}" is missing required method "run"`);
  }
  if (typeof impl.status !== "function") {
    throw new Error(`Harness "${impl.id}" is missing required method "status"`);
  }
  return impl;
}
