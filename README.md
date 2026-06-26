# togetherlink

Use Together AI models from local coding-agent CLIs.

## Install

One-liner — installs the `togetherlink`, `tclaude`, `topencode`, `tcodex`, and `tpi` commands to `~/.togetherlink/bin/` and installs [Bun](https://bun.sh) for you if it isn't already present:

```bash
curl -fsSL https://togetherlink.vercel.app/install.sh | sh
```

Then run your tool through Together models:

```bash
topencode            # OpenCode with Together GLM 5.2 (officially supported)
tclaude              # Claude Code through a local Together proxy
tcodex               # Codex through a local Responses proxy
tpi                  # Pi Code with Pi's official Together provider
```

On first launch, togetherlink asks once for your Together API key (press Enter to skip — the key is optional and can be added later with `togetherlink configure` or `TOGETHER_API_KEY`). The binary keeps itself up to date automatically from `togetherlink.vercel.app`.

If the underlying agent CLI is missing, togetherlink does not install it automatically. It prints the official install command and docs link for the selected tool, then exits.

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
node packages/cli/dist/bin/togetherlink.js codex status --json
node packages/cli/dist/bin/togetherlink.js pi status --json
```

Run through the workspace bin, which is closest to how users will invoke it:

```bash
pnpm -F @togetherlink/cli exec togetherlink help
pnpm -F @togetherlink/cli exec togetherlink opencode status --json
pnpm -F @togetherlink/cli exec togetherlink claude status --json
pnpm -F @togetherlink/cli exec togetherlink codex status --json
pnpm -F @togetherlink/cli exec togetherlink pi status --json
```

Typecheck/test:

```bash
pnpm -F @togetherlink/cli typecheck
pnpm -F @togetherlink/cli test
```

## Testing OpenCode

OpenCode is ephemeral only: `togetherlink opencode` launches OpenCode with a Together config for that session — there's no `on`/`off` flow to remember.

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink opencode status --json
pnpm -F @togetherlink/cli exec togetherlink opencode
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
- **Other providers** (Anthropic, OpenAI, Gemini, Bedrock, Zen) — the config sets
  `enabled_providers: ["togetherai"]` so OpenCode ignores every other provider
  entirely, and `disabled_providers: ["opencode"]` to additionally block the Zen
  gateway (provider id `opencode`, not `zen` — see opencode
  [issue #6979][oc-6979]). `disabled_providers` takes priority over
  `enabled_providers`.

> Note: the built-in **"Connect provider"** option (`ctrl+a` in the picker) has
> no config field to hide it, so it stays visible. But with only `togetherai`
> enabled there's nothing else active to connect to — connecting another
> provider would also be a no-op against this config's intent.

So `/models` shows only the 6 curated flagships. Each model's display name
carries a short tip (since OpenCode model entries have no separate description
field), and the provider label stays the full `Together AI`; the model names are
kept short so the per-line provider suffix OpenCode appends doesn't push them
past the picker's truncation width:

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

The Claude local proxy defaults to Together GLM-5.2 (`zai-org/GLM-5.2`) and can also route Claude Code through Kimi K2.7 Code.
Pick a backend for one launch:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude --main together-glm-5-2
pnpm -F @togetherlink/cli exec togetherlink claude --main together-kimi-k2-7-code
```

Check the ephemeral defaults without launching Claude:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude status --json
```

## Testing Codex

Codex is ephemeral only. `togetherlink` launches the terminal `codex` CLI with a local Responses-compatible proxy that translates Codex traffic to Together chat completions.

Launch Codex through Together:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink codex
```

Run Codex headlessly through Together:

```bash
pnpm -F @togetherlink/cli exec togetherlink codex -- exec "Say hi"
tcodex -- exec "Say hi"
```

Compare direct Codex/OpenAI elapsed time with togetherlink Codex/Together:

```bash
pnpm -F @togetherlink/cli exec togetherlink codex benchmark
```

Check the ephemeral defaults without launching Codex:

```bash
pnpm -F @togetherlink/cli exec togetherlink codex status --json
```

Inspect recent Codex proxy speed traces:

```bash
pnpm -F @togetherlink/cli exec togetherlink daemon profile
```

## Testing Pi Code

Pi Code is ephemeral only. `togetherlink pi` uses Pi's official Together provider (`together`) with `--no-session` and a temporary `PI_CODING_AGENT_DIR`; it does not write Pi config or sessions.

Launch Pi Code through Together:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink pi
pnpm -F @togetherlink/cli exec togetherlink picode
tpi
```

Run Pi Code headlessly through Together:

```bash
pnpm -F @togetherlink/cli exec togetherlink pi -- -p "Say hi"
tpi -- -p "Say hi"
```

Check the ephemeral defaults without launching Pi:

```bash
pnpm -F @togetherlink/cli exec togetherlink pi status --json
```
