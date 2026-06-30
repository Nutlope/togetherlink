import { spawnSync } from "node:child_process";

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertCommandExists(command: string): void {
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [command], {
    encoding: "utf8",
  });
  assert(probe.status === 0, `${command} executable is not on PATH`);
}

export function looksLikeContextError(text: string): boolean {
  return /context length|maximum context|context_length_exceeded|too many tokens|input tokens/i.test(
    text,
  );
}
