# Changelog

User-visible changes to TogetherLink are recorded here, newest first. This changelog starts with
version 0.6.5; earlier release history remains available in Git.

## 0.8.4 - 2026-08-19

### Fixed

- `togetherlink usage` now counts ChatGPT Desktop (codex-app) and other still-running proxied
  sessions. Usage was previously only recorded when a session ended, and codex-app sessions
  register without a pid so they never end while the app is open — their spend was invisible in
  the report and lost if the daemon restarted. The daemon now flushes in-memory cost to the
  session store on a cadence and on graceful shutdown, and the usage query includes active
  sessions seen within the window.

### Changed

- `togetherlink usage` model and harness breakdowns now render as Unicode box-bordered tables.
- Renamed the Codex launcher option and usage-report harness label to "Codex CLI" to distinguish
  the terminal Codex CLI from ChatGPT Desktop.

## 0.8.3 - 2026-08-15

### Added

- Added `deepseek-ai/DeepSeek-V4-Flash-0731` as a curated selectable model across Claude Code,
  Codex, OpenCode, DeepSeek Harness, Grok Build, Pi Code, Prime Agent, and ChatGPT Desktop.
- Added verified Together pricing and context metadata plus DeepSeek reasoning, text-modality,
  tool-calling, and output-limit metadata.

### Changed

- Listed DeepSeek V4 Flash last in curated model selectors and user-facing model lists while
  keeping Kimi K3 as the default.

### Tests

- Added focused coverage for exact-ID resolution and generated model catalogs across the
  supported harnesses, plus a live exact-ID Codex inference smoke.

## 0.8.2 - 2026-08-15

### Added

- Added `togetherlink usage --last 7d` to report completed Claude Code, Codex, and ChatGPT Desktop
  session cost and token usage, grouped by model and harness.
- Persisted per-model usage breakdowns in the local daemon database so completed historical
  sessions retain accurate model attribution.

### Tests

- Added focused coverage for usage-window parsing, aggregation and rendering, historical SQLite
  filtering, CLI argument handling, and the end-to-end command output.

## 0.8.1 - 2026-08-14

### Changed

- Removed the retired `moonshotai/Kimi-K2.6` model from the shared catalog, harness model choices,
  and user-facing guidance.
- Updated Claude Code's model-tier fallback so requests that previously selected Kimi K2.6 now
  use MiniMax M3.

### Tests

- Added regression coverage to keep Kimi K2.6 out of the selectable model catalog and updated
  model-resolution, Claude, Codex, harness, and telemetry expectations.

## 0.8.0 - 2026-08-14

### Changed

- Promoted `moonshotai/Kimi-K3` to the shared primary vision model for Claude Code, OpenCode, and
  Grok image-description routing.
- Kept `Qwen/Qwen3.5-9B` as the automatic vision fallback and made it Claude Code's lightweight
  Haiku-tier model.
- Removed Kimi K2.7 Code and DeepSeek V4 Pro from the curated serverless model choices ahead of
  their scheduled retirement.
- Moved daemon auto-start selection into the daemon bootstrap path so direct harnesses do not
  probe or install an unused OS supervisor.

### Fixed

- Made daemon startup automatic in Docker, devcontainers, CI, headless sessions, minimal Linux,
  and platforms without launchd/systemd by falling back to portable process mode.
- Probed launchd and systemd user-session capabilities with bounded output and timeouts before
  installation, ignored or removed stale service files when the supervisor is unavailable, and
  rolled back partially installed services.
- Drained active HTTP requests during supervised daemon shutdown so service refreshes do not sever
  in-flight Claude or Codex streams, with a deadline that force-closes stuck connections.
- Replaced the installer's manual-start guidance with the correct automatic portable-mode behavior.

### Tests

- Added deterministic coverage for unavailable, slow, and failing launchd/systemd sessions, stale
  service files, portable and Windows runtime paths, automatic daemon bootstrap, and bounded
  graceful shutdown.
- Verified the bundled CLI in clean Docker and stale-service upgrade scenarios without manual
  sentinel files, service removal, or daemon startup.

## 0.7.15 - 2026-08-14

### Added

- Added `togetherlink update` to immediately check for and install the latest release, bypassing
  the background updater's hourly throttle while preserving active proxy sessions.

### Changed

- Simplified the interactive launcher to show ChatGPT Desktop, Claude Code, Codex, OpenCode, Pi
  Code, and Configure by default, with a Show more option that reveals the less common harnesses.

### Tests

- Added deterministic coverage for the collapsed and expanded interactive launcher choices.
- Added deterministic coverage for forced bundle updates and throttle bypass behavior.

## 0.7.14 - 2026-08-13

### Added

- Added alpha support for DeepSeek Harness through `togetherlink deepseek` and the `tdeepseek`
  shortcut, using a temporary credential-free provider patch that leaves normal DSH settings
  untouched.
- Added opt-in installation of `@deepseek-ai/dsh` when—and only when—the user explicitly invokes
  or selects DeepSeek Harness.

### Changed

- Hid DSH's native DeepSeek models when `DEEPSEEK_API_KEY` is absent, while keeping Together AI
  models available and selected by default. Native and Together models remain available together
  when the native key is present.
- Added DeepSeek Harness to the website with its official fish mark, and gave Alpha, Beta, and 100%
  Supported badges distinct visual status treatments.

### Fixed

- Prevented Codex from turning Together `length` finish reasons that stopped far below the requested
  output budget into fatal `stream disconnected before completion` errors.
- Unified Claude and Codex output budgeting so oversized input estimates cannot collapse a request
  to a one-token output budget and cause repeatable truncation failures.

### Tests

- Added deterministic coverage for DeepSeek provider generation, native-model credential gating,
  demand installation, wrapper registration, and launch isolation.
- Added shared output-budget and short-length-stop regression coverage for Claude and Codex.

## 0.7.13 - 2026-08-13

### Fixed

- Reused Pi Code's managed `fd` and `rg` binaries across launches instead of re-downloading them on
  every run. TogetherLink points `PI_CODING_AGENT_DIR` at a fresh temporary directory per launch,
  which hid the tools Pi had already downloaded under `~/.pi/agent/bin`; the temporary directory is
  now seeded from that location before launch, and any first-time download is persisted back so it
  is reused on later runs.

### Changed

- Routed the root `pnpm test` script through Turbo with an explicit test task that declares the
  live-test and Vitest environment variables, so test runs share Turbo's build orchestration and
  caching.

### Tests

- Added deterministic coverage for seeding and persisting Pi Code's managed `fd`/`rg` binaries,
  including never overwriting an existing user-managed binary.

## 0.7.12 - 2026-08-12

### Fixed

- Pinned the absolute Bun runtime in macOS `launchd` and Linux `systemd` daemon definitions instead
  of invoking a shell wrapper that could fail when the supervisor did not inherit a version-manager
  PATH. Existing supervised installs migrate automatically.

### Tests

- Added deterministic launchd and systemd coverage for Bun installations outside standard PATH
  locations.

## 0.7.11 - 2026-08-12

### Fixed

- Automatically repair and reload an installed `launchd` or `systemd` daemon service once when a
  normal restart does not restore proxy health.
- Replaced the misleading suggestion to change the shared proxy port with actionable daemon
  install, status, and log diagnostics that preserve ChatGPT Desktop routing.

### Tests

- Isolated live Prime Agent retry transcripts so a model-sensitive retry cannot count children
  persisted by earlier attempts.
- Added deterministic coverage for automatic daemon supervisor repair and recovery guidance.

## 0.7.10 - 2026-08-11

### Added

- Added Prime Agent beta support through `togetherlink prime` and the `tprime` shortcut, using a
  generated credential-free provider extension so native Prime settings and sessions stay intact.

### Changed

- Updated the documented installer command to invoke Bash explicitly, fixing installation on
  Debian systems where `/bin/sh` is Dash and does not support `pipefail`.
- Clarified that per-run model selection, including Claude Code model pinning, must place
  `--model` before the harness name so TogetherLink consumes the flag.

### Fixed

- Inserted TogetherLink's generated Codex `-c` overrides before a caller-provided `--` separator,
  preserving arbitrary prompt arguments while keeping the overrides parseable by Codex.
- Backfilled installer-style PATH symlinks for wrapper commands added by auto-update, without
  replacing existing user commands.

### Operations

- Migrated existing CLI users from legacy detached daemons to the installed `launchd` or `systemd`
  service during upgrade, and made installed bundles restart that service instead of spawning a
  competing daemon. Installation now waits for the managed daemon to become healthy before it
  completes.
- Made the OS supervisor restart the shared proxy after every unexpected exit, including a clean
  exit after `SIGTERM`, so ChatGPT Desktop cannot remain disconnected just because the daemon shut
  down gracefully. Existing supervised installs migrate automatically to the stronger policy.
- Routed `togetherlink daemon stop` through the OS supervisor so an intentional stop remains
  possible without fighting the always-restart policy, and added persistent lifecycle logs for
  supervised starts and shutdown signals.

### Tests

- Added deterministic coverage for legacy-daemon takeover, supervised port races, and restarting an
  installed service from the public daemon launcher.
- Added deterministic coverage for unconditional macOS and Linux daemon restart policies.
- Added a Codex launcher regression covering generated configuration, passthrough separators, and
  prompt tokens that resemble command-line flags.
- Added Prime provider, native passthrough, concurrent endpoint-isolation, and installed-wrapper
  regression coverage.
- Added an opt-in live Prime RLM lifecycle test covering a real recursive child, inherited Together
  routing, child-to-parent messaging, persisted transcripts, and child usage attribution.

## 0.7.9 - 2026-08-10

### Added

- Completed the ChatGPT Codex endpoint matrix with native image generation/editing and alpha-search
  pass-through, local Together-backed Responses compaction v1/v2, memory trace summarization, and
  compatibility aliases with or without the `/v1` prefix.

### Changed

- Increased `zai-org/GLM-5.2` serverless context from 262,144 to 512,000 tokens; pricing is
  unchanged.
- Simplified Codex context handling so conversation history and historical images pass through
  unchanged while Codex owns compaction; TogetherLink now advertises model-specific compaction
  thresholds and the native-style 10k tool-output truncation policy.
- Sanitized provider-specific response items and tool/search payloads at the OpenAI-Together
  boundary without mutating ordinary conversation history.

### Fixed

- Preserved Together context-length and HTTP error codes in Responses errors instead of hiding
  them behind generic proxy failures.
- Added native and Together-backed Responses-over-WebSocket support for ChatGPT Desktop, including
  incremental continuations, the `/responses` compatibility alias, and safe abnormal-close handling.
- Kept default Together output budgets inside each model's remaining context window, including a
  safety margin for request-estimation error.
- Ended partially-started native responses cleanly when the upstream body fails after headers have
  already been sent.
- Kept Exa web-search results inside structured `web_search_call` items instead of exposing raw
  search payloads as assistant replies, and discarded unfinished pre-search drafts so Desktop
  renders the search event before one clean final answer.

### Tests

- Added deterministic coverage for compaction v1/v2, memories, native route pass-through,
  Responses-over-WebSocket routing and continuation, response item normalization, transport
  validation, context budgeting, error propagation, and mixed web-search/client-tool turns.

### Operations

- Added a macOS `launchd` user agent (`com.togetherlink.daemon`) that auto-starts the shared proxy
  daemon at login and keeps it alive, so ChatGPT Desktop no longer hits `Connection refused` after
  a MacBook restart.
- Existing installed bundles silently install the agent once on the next CLI launch; new installs get
  it automatically from `install.sh`.
- Added `togetherlink daemon install-launchd`, `uninstall-launchd`, and `status` commands.

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
