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

## History ownership

The Codex proxy forwards ordinary conversation history and user-attached images
without deleting, summarizing, or retrying with modified content. Tool-generated
`view_image` screenshots have a narrower lifecycle: the newest screenshot stays
as native vision input, while an older screenshot is replaced after a subsequent
assistant observation exists. The replacement retains a content hash, that
observation, and the original local path so Codex can explicitly inspect it
again. Base64 image transport bytes are excluded from the text-token estimate.

Codex otherwise owns context accounting and decides when to request compaction;
TogetherLink maps Together context errors to the standard Responses error
contract and serves client-requested compaction through the selected Together
model.

Native replay has one narrow compatibility exception: for synthetic reasoning
items whose IDs were minted by TogetherLink and whose encrypted transport state
cannot be replayed by OpenAI, the proxy removes only the unusable `id` and
`encrypted_content` fields while preserving visible summaries and content.
Restore applies the same repair to existing TogetherLink-shaped task history,
after backing up every changed JSONL file.

Future investigation: extend the same evidence-preserving lifecycle to other
high-volume tool-generated screenshots only after reproducing their exact wire
format. Do not retire user attachments or tool images that have no subsequent
assistant observation.
