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

The OpenCode default model (GLM-5.2) is **text-only** — it cannot see image
content. When you paste or attach an image, OpenCode strips the image bytes
before they reach GLM-5.2, but the model is still told an image was attached.

A `@vision` subagent is registered on a vision-capable Together model
(Kimi-K2.7-Code). The primary `build` agent is instructed to **invoke `@vision`
itself via the Task tool** when it detects an image was attached — you should
not need to do anything. The subagent describes the image and the primary model
reasons over that description.

If auto-delegation doesn't fire, you can invoke it explicitly:

```
@vision describe what's in this screenshot
```

### Caveats

- Auto-delegation depends on GLM-5.2 noticing the attachment marker and using
  the Task tool; it may not always fire.
- There is an open upstream bug ([#25553][oc-25553]) where an image attached with
  a `@vision` mention isn't always forwarded to the subagent in some UIs. A fix
  for the subtask path was merged ([#20021][oc-20021]).
- If vision just won't work, switch the primary model to a vision-capable one via
  `/models` (the vision models are registered there) so it sees images directly.

## /models is curated

OpenCode merges a provider's declared `models` block on top of its full
[models.dev](https://models.dev) catalog, so without filtering, `/models` shows
hundreds of Together models. The config sets a `whitelist` (added in opencode
[PR #3416][oc-3416]) restricting the Together provider to **only** the models
togetherlink declares: GLM-5.2 plus the vision models. That's all you'll see.

[oc-25553]: https://github.com/sst/opencode/issues/25553
[oc-20021]: https://github.com/sst/opencode/issues/20021
[oc-3416]: https://github.com/sst/opencode/pull/3416

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
