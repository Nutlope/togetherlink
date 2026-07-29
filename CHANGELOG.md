# Changelog

User-visible changes to TogetherLink are recorded here, newest first. This changelog starts with
version 0.6.5; earlier release history remains available in Git.

## 0.7.3 - 2026-07-29

### Fixed

- Propagated Claude and Codex client disconnects through active Together SSE body readers and
  retry backoff, preventing canceled turns from surviving as orphaned upstream requests or
  starting a later retry.
- Returned response-header watchdog failures as `504 timeout_error` responses instead of generic
  `500` API errors.

### Debugging

- Logged when a disconnected Claude or Codex client aborts its active upstream request, alongside
  the existing Together response-header and request-ID trace.

### Tests

- Added deterministic coverage proving that cancellation after streaming starts cancels the
  Together body reader, skips retries, and does not emit a successful stream terminator.

## 0.7.2 - 2026-07-29

### Changed

- Enabled Claude Code thinking summaries by default for TogetherLink-launched sessions, so
  Together reasoning can be expanded with Claude Code's verbose transcript view.

### Debugging

- Added successful Together response headers, status, header latency, retry attempt, endpoint,
  and client/upstream request IDs to opt-in proxy debug logs. Existing per-call usage records
  continue to report input, output, and cached tokens alongside the transport trace.

### Tests

- Added deterministic coverage for ephemeral Claude thinking-summary settings and successful
  response-header logging without exposing request credentials.

## 0.7.1 - 2026-07-29

### Changed

- Advertised Kimi K3's 1M context correctly to Claude Code, routed image blocks directly through
  the vision-capable model, and removed the unsupported Fable tier from Claude's model menu.
- Derived Claude reasoning-effort support from shared model metadata instead of adapter-specific
  model checks.

### Fixed

- Recovered Kimi context overflows and transient Together failures before they could strand a
  Claude or Codex turn.
- Retried streams that stalled after reasoning or an incomplete tool call while replay was still
  safe, preserved slow Together admission requests, and bounded the total duration of active
  streams.

### Tests

- Added deterministic coverage for context fitting, response-header and SSE watchdogs, safe
  pre-output retries, incomplete tool calls, and whole-turn timeouts.

## 0.7.0 - 2026-07-27

### Changed

- Made Kimi K3 the shared default model for Claude Code, Codex, OpenCode, Grok Build, Pi Code, and
  new desktop configurations while keeping GLM 5.2 and Kimi K2.7 Code selectable.
- Added Kimi K3's 1,048,576-token context, 131,072-token output ceiling, vision support, pricing,
  and model-specific `low`, `high`, and `max` reasoning effort metadata.

### Tests

- Added a live release gate covering Together's docs and authenticated catalog, chat, streaming,
  function calling, JSON mode, output-ceiling acceptance, and all Kimi K3 reasoning efforts.
- Verified real headless responses, tool calls, coding tasks, long context, and model metadata
  through the supported coding harnesses.

## 0.6.7 - 2026-07-23

### Fixed

- Prevented Claude Code from adding Claude attribution to commits and pull requests created during
  TogetherLink sessions.

## 0.6.6 - 2026-07-23

### Changed

- `tgrok` now uses Grok Build's normal home directly, preserving native settings, plugins,
  workflows, built-ins, and sessions without rewriting `config.toml`.
- Enabled Grok workflows by default and exposed TogetherLink's curated Together models to parent
  agents, workflow children, and auxiliary model tasks.
- Model inference continues to go directly to Together AI; the local server only adapts model
  catalog metadata and is not an inference proxy.

### Fixed

- Prevented title generation, session summaries, prompt suggestions, and related auxiliary tasks
  from falling back to Grok 4.5.
- Isolated saved xAI authentication and blocked xAI-only voice, web search, and Imagine services
  from receiving the Together API key during a `tgrok` session.

### Tests

- Added deterministic Grok catalog, environment, auth-isolation, workflow, and auxiliary-model
  coverage, plus live GLM 5.2 inference and native Grok configuration checks.

## 0.6.5 - 2026-07-22

### Fixed

- Made Codex sessions portable by session ID between native Codex and `tcodex`, in both
  directions. Together reasoning remains visible while streaming but is stored in a form that
  native Codex can safely replay.
- Detect and recover Together streams that close before their completion marker, or return a
  clear proxy error when recovery is no longer safe.

### Tests

- Added deterministic coverage for replaying reasoning, shell calls, custom tools, tool outputs,
  and file changes across resumed Codex turns.
- Added an opt-in local live suite for `codex` to `tcodex` and `tcodex` to `codex` switching. The
  live suite remains disabled in normal CI and uses the developer's local Codex authentication.
