import { appendFile, chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { togetherlinkHome } from "./paths.js";

const REQUEST_DIAGNOSTICS_FILE = "request-diagnostics.jsonl";

export type TogetherRequestDiagnostic = {
  at: string;
  phase: "response_headers" | "sse";
  reason: "timeout" | "network_error" | "caller_abort" | "idle_timeout" | "premature_close";
  clientRequestId: string;
  upstreamRequestId?: string | undefined;
  model?: string | undefined;
  attempt?: number | undefined;
  timeoutMs?: number | undefined;
  error?: string | undefined;
};

/**
 * Persist only transport metadata: no API keys, prompts, response content, or
 * tool arguments. This gives stalled requests a durable local correlation ID
 * without turning diagnostics into a transcript store.
 */
export async function persistRequestDiagnostic(
  diagnostic: Omit<TogetherRequestDiagnostic, "at">,
): Promise<void> {
  if (process.env.TOGETHERLINK_REQUEST_DIAGNOSTICS === "0") {
    return;
  }
  const file = resolveRequestDiagnosticsPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...diagnostic })}\n`, {
    mode: 0o600,
  });
  await chmod(file, 0o600).catch(() => undefined);
}

export function resolveRequestDiagnosticsPath(home = togetherlinkHome()): string {
  return path.join(home, REQUEST_DIAGNOSTICS_FILE);
}
