/**
 * Small JSON/unknown-value helpers shared by every harness translator.
 *
 * These existed as near-identical copies in `claude/content-format.ts` and
 * `codex/content-format.ts` and had already drifted — the Codex copies grew
 * null handling and a try/catch that the Claude copies never got. One copy,
 * the hardened behaviour, both paths.
 */

export function objectKeys(value: unknown): string[] | undefined {
  return value && typeof value === "object"
    ? Object.keys(value as Record<string, unknown>)
    : undefined;
}

/** Pass strings through untouched; render anything else as JSON, never throwing. */
export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Parse tool-call arguments, falling back to `{}` for absent or malformed JSON. */
export function parseJsonOrEmpty(value: string | undefined): unknown {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
