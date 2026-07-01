# Codex Adapter

`tcodex` launches the native Codex CLI through a local TogetherLink proxy. The adapter keeps two kinds of configuration separate:

- TogetherLink endpoint, provider, model, and catalog settings are passed as per-launch `-c` overrides. They must not be persisted to `~/.codex/config.toml`, so normal `codex` launches keep using the user's own provider setup.
- Generic Codex user preferences belong to Codex. Settings such as `approval_policy`, `sandbox_mode`, permission profiles, rules, and project trust should be read by Codex from `~/.codex/config.toml`, not rewritten by TogetherLink.

The only generic config write allowed by `tcodex` is the first-run safety seed: if `~/.codex/config.toml` is missing or empty, create it with Codex's "Auto + approve for me" posture:

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
approvals_reviewer = "auto_review"
```

If `~/.codex/config.toml` already has any content, leave it untouched, even if it does not include `approval_policy`. If the user passes `--ignore-user-config` through to Codex, skip even the first-run seed.
