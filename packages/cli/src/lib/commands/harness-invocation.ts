import { ALL_HARNESSES, type HarnessId } from "../harness.js";
import type { ParsedArgs } from "../parse-args.js";

export type HarnessInvocation = {
  command: HarnessId | string | undefined;
  flags: ParsedArgs["flags"];
};

export function resolveHarnessInvocation(positional: string[], flags: ParsedArgs["flags"]): HarnessInvocation {
  const [rawCommand, ...passthrough] = positional;
  const command = rawCommand === "picode" ? "pi" : rawCommand;

  return isHarnessCommand(command)
    ? { command, flags: withPrependedPassthrough(flags, passthrough) }
    : { command, flags };
}

export function isHarnessCommand(value: string | undefined): value is HarnessId {
  return value !== undefined && (ALL_HARNESSES as readonly string[]).includes(value);
}

function withPrependedPassthrough(flags: ParsedArgs["flags"], args: string[]): ParsedArgs["flags"] {
  const passthrough = [...args, ...(flags.passthrough ?? [])];
  if (passthrough.length === 0) {
    return flags;
  }
  const hasSeparator = passthrough[0] === "--";
  return {
    ...flags,
    passthrough: hasSeparator ? passthrough.slice(1) : passthrough,
    ...(hasSeparator ? { passthroughSeparator: true } : {}),
  };
}
