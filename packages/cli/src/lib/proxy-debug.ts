import { writeDebugLogLine } from "./debug-log.js";

export type ProxyDebugOptions = {
  debug?: boolean | undefined;
};

export function writeProxyDebugLog(
  prefix: string,
  options: ProxyDebugOptions | undefined,
  label: string,
  value: unknown | (() => unknown),
): void {
  if (!options?.debug) {
    return;
  }
  const payload = typeof value === "function" ? value() : value;
  writeDebugLogLine(`[${prefix}] ${label}: ${JSON.stringify(payload)}\n`);
}
