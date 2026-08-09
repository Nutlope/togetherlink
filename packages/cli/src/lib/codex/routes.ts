const CODEX_V1_ALIAS_PATHS = new Set([
  "/models",
  "/responses",
  "/responses/compact",
  "/alpha/search",
  "/images/generations",
  "/images/edits",
  "/memories/trace_summarize",
]);

export const CODEX_RESPONSES_PATH = "/v1/responses";
export const CODEX_COMPACTION_PATH = "/v1/responses/compact";
export const CODEX_MEMORIES_PATH = "/v1/memories/trace_summarize";

const CODEX_NATIVE_ONLY_PATHS = new Set([
  "/v1/alpha/search",
  "/v1/images/generations",
  "/v1/images/edits",
]);

export function normalizeCodexPath(path: string): string {
  return CODEX_V1_ALIAS_PATHS.has(path) ? `/v1${path}` : path;
}

export function isCodexResponsesPath(path: string): boolean {
  const normalized = normalizeCodexPath(path);
  return normalized === CODEX_RESPONSES_PATH || normalized === CODEX_COMPACTION_PATH;
}

export function isCodexResponsesWebsocketPath(path: string): boolean {
  return normalizeCodexPath(path) === CODEX_RESPONSES_PATH;
}

export function isCodexNativeOnlyPath(path: string): boolean {
  return CODEX_NATIVE_ONLY_PATHS.has(normalizeCodexPath(path));
}
