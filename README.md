# togetherlink

Use Together AI models from local coding-agent CLIs.

## Local Development

Install dependencies from the repo root:

```bash
pnpm install
```

Build the TypeScript CLI:

```bash
pnpm -F @togetherlink/cli build
```

Keep the CLI rebuilding while you edit:

```bash
pnpm dev
```

Leave that running in one terminal, then run `togetherlink` commands from another terminal.

Run the built CLI directly:

```bash
node packages/cli/dist/bin/togetherlink.js help
node packages/cli/dist/bin/togetherlink.js opencode status --json
node packages/cli/dist/bin/togetherlink.js claude status --json
```

Run through the workspace bin, which is closest to how users will invoke it:

```bash
pnpm -F @togetherlink/cli exec togetherlink help
pnpm -F @togetherlink/cli exec togetherlink opencode status --json
pnpm -F @togetherlink/cli exec togetherlink claude status --json
```

Typecheck/test:

```bash
pnpm -F @togetherlink/cli typecheck
pnpm -F @togetherlink/cli test
```

## Testing OpenCode

OpenCode is persistent: `on` writes OpenCode config and snapshots the original so `off` can restore it.

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink opencode status --json
pnpm -F @togetherlink/cli exec togetherlink opencode on
pnpm -F @togetherlink/cli exec togetherlink opencode status --json
pnpm -F @togetherlink/cli exec togetherlink opencode off
```

## Images and vision in OpenCode

Vision support depends on which model is active. The `build` agent's system
prompt is **one unified instruction** that lets the model self-select by its own
runtime capabilities, so it stays correct even if you switch models mid-session:

- **Vision-capable primary** (Kimi K2.6, Kimi K2.7-Code, MiniMax M3, Qwen 3.7
  Max): OpenCode sends the image directly to the model — it sees it and just
  uses it. **This is the working path for images.**
- **Text-only primary** (GLM-5.2, DeepSeek V4 Pro): OpenCode strips the image
  bytes before they reach the model. The model tells you plainly it can't see
  images and that you should switch to a vision-capable model via `/models`
  (Kimi K2.6, MiniMax M3, or Qwen 3.7 Max) and re-send the image.

### The `@vision` subagent and why it doesn't work for clipboard images

A `@vision` subagent is still registered (pinned to Kimi-K2.7-Code), but it
**does not work for clipboard-pasted images today**: OpenCode has an open bug
([#25553][oc-25553]) where an image attached with `@vision` is not forwarded to
the subagent — the subagent only errors with *"this model does not support image
input"*. The build prompt is therefore configured to tell text-only primaries
**not** to auto-invoke `@vision` (it would just produce that error). The
reliable path is to switch the primary model to a vision one via `/models`.

A fix for the subagent image-forwarding path is in progress upstream
([PR #32302][oc-32302]); once it merges, `@vision` for clipboard images should
work and the prompt can re-enable auto-delegation.

## /models is curated

OpenCode normally shows two extra sources of clutter alongside our declared
Together models, both suppressed by the emitted config:

- **Together's full serverless catalog** — OpenCode merges a provider's declared
  `models` block on top of its full [models.dev](https://models.dev) catalog.
  The config sets a `whitelist` (added in opencode
  [PR #3416][oc-3416]) restricting the Together provider to **only** the
  current flagships togetherlink ships.
- **OpenCode Zen** — the auto-loaded `opencode/*` gateway provider (a curated
  paid model list). The config sets `disabled_providers: ["opencode"]` to hide
  it (the provider id is `opencode`, not `zen` — see opencode
  [issue #6979][oc-6979]).

So `/models` shows only the 6 curated flagships. Each model's display name
carries a short tip (since OpenCode model entries have no separate description
field), and the provider label is shortened to `Together` so the per-line suffix
OpenCode appends doesn't push names past the picker's truncation width:

| Model id | Vision | Use case |
|---|---|---|
| `zai-org/GLM-5.2` | ❌ | default, agentic coding (text-only) |
| `moonshotai/Kimi-K2.6` | ✅ | reasoning + vision |
| `moonshotai/Kimi-K2.7-Code` | ✅ | code; also the `@vision` subagent model |
| `MiniMaxAI/MiniMax-M3` | ✅ | cheapest vision, 512K context |
| `Qwen/Qwen3.7-Max` | ✅ | strongest Qwen, 1M context |
| `deepseek-ai/DeepSeek-V4-Pro` | ❌ | long-context reasoning (512K) |

That's all you'll see in `/models`. The curated set lives in
[`@togetherlink/models`](packages/models/src/index.ts) (`SELECTABLE_MODELS`).

[oc-25553]: https://github.com/sst/opencode/issues/25553
[oc-32302]: https://github.com/sst/opencode/pull/32302
[oc-3416]: https://github.com/sst/opencode/pull/3416
[oc-6979]: https://github.com/sst/opencode/issues/6979

## Testing Claude Code

Claude Code is ephemeral only. `togetherlink` does not write `~/.claude/settings.json` and there is no `claude on/off` flow to remember.

Launch Claude Code through the local Together proxy:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink claude
```

Pass arguments through to `claude` after `--`:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude -- --help
pnpm -F @togetherlink/cli exec togetherlink claude -- --version
```

The Claude local proxy always sends requests to Together GLM-5.2 (`zai-org/GLM-5.2`).
Override only the displayed Claude model option for one launch:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude --main together-glm-5-2
```

Check the ephemeral defaults without launching Claude:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude status --json
```
