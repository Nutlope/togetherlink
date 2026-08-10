# Changelog

User-visible changes to TogetherLink are recorded here, newest first. This changelog starts with
version 0.6.5; earlier release history remains available in Git.

## 0.7.8 - 2026-08-10

### Added

- Added Hermes Agent and Hermes Desktop support through the single `togetherlink hermes` command,
  with `thermes` as the short command and `thermes desktop` for the desktop app.
- Added a temporary, credential-isolated Together provider overlay that preserves native Hermes
  sessions, skills, memories, plugins, preferences, and configuration without modifying them.
- Added Hermes to the installer, CLI help, machine-readable documentation, and supported-agent
  cards on the website.

### Tests

- Added deterministic coverage for terminal and desktop command routing, Together provider
  configuration, credential isolation, preserved native state, and cleanup behavior.

## 0.7.7 - 2026-08-08

### Changed

- Enabled Claude Code same-machine cross-session messaging by default for TogetherLink-launched
  sessions on supported Claude Code versions.
- Enforced Claude Code's concise system prompt for Together gateway models while preserving an
  explicit user override.
- Expanded the dashboard with audience, geography, session lifecycle, harness usage, and likely
  unique-user metrics, including admin traffic exclusion.

### Tests

- Added launcher regression coverage for the cross-session messaging override and inherited
  environment values.

## 0.7.6 - 2026-08-01

### Fixed

- Rejected unsupported Codex Responses WebSocket upgrades immediately with `426 Upgrade Required`,
  allowing ChatGPT Desktop to fall back to HTTP/SSE without repeated reconnect timeouts.

### Tests

- Added a loopback daemon regression proving WebSocket upgrades receive `426`, close immediately,
  and remain covered by the core release gauntlet.

## 0.7.5 - 2026-07-31

### Changed

- Made the ChatGPT Desktop integration additive: native GPT and Together AI models now share the
  same Codex picker, while requests route to ChatGPT or Together according to the selected model.
- Preserved the user's native provider and default model unless `--model` is passed explicitly.

### Fixed

- Isolated Node Together requests from the process-global connection pool and disabled upstream
  connection reuse under Bun, preventing a poisoned long-lived daemon transport from turning
  otherwise healthy requests into repeated synthetic `503 fetch failed` responses.
- Removed embedded image payloads from completed user turns before sending requests upstream while
  preserving every image in the latest user turn, reducing long-session request size and vision
  context without breaking multi-image prompts.

### Tests

- Added deterministic coverage for merged native/Together catalogs, zstd-compressed Desktop
  requests, native ChatGPT pass-through, and strict cross-provider credential isolation.
- Added deterministic coverage proving Together requests still succeed when global `fetch` is
  broken and that each Node attempt owns a distinct dispatcher.
- Added coverage proving historical images are removed before the first upstream request while all
  current-turn images remain intact.

## 0.7.4 - 2026-07-30

### Fixed

- Classified upstream SSE reader terminations as premature closes, allowing safe pre-output
  retries and surfacing an explicit error after actionable output instead of silently ending the
  Claude turn successfully.

### Tests

- Added deterministic coverage for retrying or surfacing terminated SSE readers according to
  whether actionable harness output has begun.

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
