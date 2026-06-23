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
