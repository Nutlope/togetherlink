import type { HarnessId } from "./harness.js";

const REQUIRED_METHODS = ["on", "off", "status"] as const;

export type HarnessContext = {
  home: string;
  apiKey?: string;
  apiKeyFromFlag?: boolean;
  main?: string;
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
  resolveKey?: (ctx: HarnessContext) => Promise<string>;
  on: (ctx: HarnessContext) => Promise<HarnessResult>;
  off: (ctx: HarnessContext) => Promise<HarnessResult>;
  status: (ctx: HarnessContext) => Promise<HarnessResult>;
};

/**
 * Defines a harness adapter. Throws early (at module load) if a harness is
 * missing a required method, rather than failing confusingly at dispatch
 * time.
 */
export function defineHarness(impl: Harness): Harness {
  for (const method of REQUIRED_METHODS) {
    if (typeof impl[method] !== "function") {
      throw new Error(`Harness "${impl.id}" is missing required method "${method}"`);
    }
  }
  return impl;
}
