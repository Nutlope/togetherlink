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

The OpenCode default model (GLM-5.2) is **text-only** — it cannot see images.
OpenCode gates this client-side: when you paste or attach an image, the image
part is dropped before it reaches GLM-5.2, so the model only sees your text.

There is no automatic routing to a vision model (unlike the Claude proxy, which
intercepts images server-side). Instead a `@vision` subagent is registered on a
vision-capable Together model. To describe an image, invoke it explicitly:

```
@vision describe what's in this screenshot
```

The subagent replies with a description, which the primary model can then reason
over. If you paste an image without `@vision`, GLM-5.2 will tell you it can't see
images and prompt you to use `@vision` — that's intentional, so you don't get a
fake/guessed description.

> Note: `@vision` relies on OpenCode's subagent invocation, which has had
> reliability bugs upstream ([#19538][oc-19538], [#29616][oc-29616]). If `@vision`
> doesn't fire, switch the primary model to a vision-capable one via `/models`
> (the vision models are registered there) so it sees the image directly.

[oc-19538]: https://github.com/sst/opencode/issues/19538
[oc-29616]: https://github.com/sst/opencode/issues/29616

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
