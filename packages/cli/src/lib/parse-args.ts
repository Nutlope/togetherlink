import type { HarnessContext } from "./harness-types.js";

const FLAG_ALIASES = {
  "--api-key": "apiKey",
  "--main": "main",
  "--search": "search",
  "--slot": "slot",
} as const satisfies Record<string, keyof HarnessContext>;

const BOOLEAN_FLAGS = new Set(["--json"]);
type BooleanFlag = "json";
const BOOLEAN_FLAG_KEYS = {
  "--json": "json",
} as const satisfies Record<string, BooleanFlag>;

export type ParsedArgs = {
  positional: string[];
  flags: Partial<HarnessContext> & Record<BooleanFlag, boolean>;
};

/**
 * Minimal positional + flag parser — no dependency needed for the surface
 * area this CLI has (harness-first verbs plus a handful of flags).
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional = [];
  const flags: ParsedArgs["flags"] = { json: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) {
      continue;
    }
    if (BOOLEAN_FLAGS.has(token)) {
      flags[BOOLEAN_FLAG_KEYS[token as keyof typeof BOOLEAN_FLAG_KEYS]] = true;
      continue;
    }
    if (token in FLAG_ALIASES) {
      const key = FLAG_ALIASES[token as keyof typeof FLAG_ALIASES];
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error(`Flag ${token} expects a value`);
      }
      flags[key] = value;
      i += 1;
      continue;
    }
    positional.push(token);
  }

  if (flags.apiKey) {
    flags.apiKeyFromFlag = true;
  }

  return { positional, flags };
}
