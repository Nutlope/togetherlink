# Changelog

User-visible changes to TogetherLink are recorded here, newest first. This changelog starts with
version 0.6.5; earlier release history remains available in Git.

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
