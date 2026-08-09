/**
 * Native ChatGPT request metadata that is safe and necessary to preserve.
 * HTTP passthrough and Responses-over-WebSocket use the same allowlist so new
 * Codex session headers cannot silently work in one transport but not the
 * other.
 */
export const NATIVE_CODEX_FORWARD_HEADERS = new Set([
  "authorization",
  "chatgpt-account-id",
  "conversation_id",
  "openai-beta",
  "originator",
  "session_id",
  "session-id",
  "thread-id",
  "user-agent",
  "version",
  "x-client-request-id",
  "x-codex-beta-features",
  "x-codex-image-turn-id",
  "x-codex-installation-id",
  "x-codex-parent-thread-id",
  "x-codex-turn-metadata",
  "x-codex-turn-state",
  "x-codex-window-id",
  "x-oai-attestation",
  "x-openai-internal-codex-responses-lite",
  "x-openai-memgen-request",
  "x-openai-subagent",
  "x-responsesapi-include-timing-metrics",
]);
