# Changelog

User-visible changes to TogetherLink are recorded here, newest first. This changelog starts with
version 0.6.5; earlier release history remains available in Git.

## Unreleased

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
