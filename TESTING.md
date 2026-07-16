# Testing

Use these checks when changing the Claude local proxy or CLI launch path.

## Regression-First Debugging

When a user reports a concrete agent/proxy failure, do not start with the fix. First turn the report into a red-capable regression at the closest stable seam.

Use this loop:

1. Capture the exact failing prompt, command, trace row, or session artifact.
2. Add a focused test that reproduces the bad protocol shape or output. The test should fail on the current code for the same reason the user saw.
3. Run only that focused test and confirm it fails.
4. Patch the smallest proxy or launcher boundary that makes the regression pass.
5. Run the focused test again, then the relevant typecheck/build.
6. Re-run a live smoke using the user's original pattern when the bug depends on real Codex, Claude, Grok, OpenCode, Pi, or Together behavior.

For Codex proxy bugs, prefer `packages/tests/src/CodexProxyApi.test.ts` for deterministic protocol regressions before doing a live `tcodex -- exec ...` smoke. Examples of patterns that need regression coverage:

- parallel `multi_agent_v1` calls must stay in one assistant tool-call group before their tool outputs;
- more than five parallel subagent calls must preserve all call IDs and outputs;
- native `web_search` must not leak back to Codex as an unsupported client tool, including when it appears in the same parallel group as client tools;
- function-shaped tools named `web_search` still count as proxy-native search tools.

If a correct automated seam does not exist, document that explicitly in the bug notes and use the smallest live command as the temporary regression signal.

## Setup

Install dependencies and build the CLI:

```bash
pnpm install
pnpm -F @togetherlink/cli build
```

For local development, keep TypeScript rebuilding in one terminal:

```bash
pnpm dev
```

Run smoke tests from another terminal.

Quick local checks:

```bash
pnpm -F @togetherlink/cli typecheck
pnpm -F @togetherlink/cli test
```

## Manual Harness Launches

Use these commands for quick live launches while validating a harness manually.

### OpenCode

OpenCode uses ephemeral Together settings: `togetherlink opencode` injects the Together provider config only for that launch, so there is no `on`/`off` flow and no OpenCode config rewrite. OpenCode's own local session history can still persist normally.

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink opencode
```

### Claude Code

Claude Code uses ephemeral Together settings. `togetherlink` does not write `~/.claude/settings.json` and there is no `claude on/off` flow to remember; Claude Code's own session/history behavior is left intact.

Launch Claude Code through the local Together proxy:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink claude
```

Pass arguments through to `claude` after the harness name:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude --help
pnpm -F @togetherlink/cli exec togetherlink claude --version
```

The Claude local proxy defaults to Together GLM-5.2 (`zai-org/GLM-5.2`) and can route Claude Code through any curated Together model in the repo's shared model list.
Pick a backend for one launch:

```bash
pnpm -F @togetherlink/cli exec togetherlink --main together-glm-5-2 claude
pnpm -F @togetherlink/cli exec togetherlink --main together-kimi-k2-7-code claude
pnpm -F @togetherlink/cli exec togetherlink --main Qwen/Qwen3.7-Max claude
```

### Grok Build

Grok Build uses direct Together chat completions. `togetherlink grok` creates a temporary `GROK_HOME`, registers the curated Together model catalog, snapshots the user's non-model settings as a lower-priority layer, and links normal Grok sessions and user resources into the temporary home. It also appends a compact identity rule through Grok's native `--rules` flag so the Together model does not claim to be an xAI model; user-supplied rules are preserved. The real `~/.grok/config.toml` and Grok authentication stay untouched.

Install Grok from xAI, then launch it through Together:

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink grok
tgrok
```

Run Grok headlessly through Together:

```bash
tgrok --output-format streaming-json --disable-web-search --no-memory --no-subagents -p "Say hi"
```

Grok's native `web_search` auxiliary model requires an endpoint with Responses API web-search support, which Together chat completions does not currently provide. Use `--disable-web-search` for deterministic headless runs.

### Codex

Codex uses ephemeral Together settings. `togetherlink` launches the terminal `codex` CLI with per-run config flags and a local Responses-compatible proxy that translates Codex traffic to Together chat completions, while leaving Codex's own session/history behavior intact.

Launch Codex through Together:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink codex
```

Run Codex headlessly through Together:

```bash
pnpm -F @togetherlink/cli exec togetherlink codex exec "Say hi"
tcodex exec "Say hi"
```

### Codex App

Codex App support is an alpha feature. Unlike `togetherlink codex`, it persistently patches Codex's user config so the desktop app can use togetherlink's local Responses-compatible proxy. The config stays active until you run `--restore`, similar to `ollama launch codex-app`. If Codex App is already open, togetherlink asks before restarting it so the new profile can load.

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink codex-app
pnpm -F @togetherlink/cli exec togetherlink codex-app --model moonshotai/Kimi-K2.7-Code
```

Restore the previous Codex config:

```bash
pnpm -F @togetherlink/cli exec togetherlink codex-app --restore
```

Backups live under `~/.togetherlink/backup/codex-app/`. The managed model catalog lives under `~/.codex/` so Codex Desktop can load it, and the session lock lives under `~/.togetherlink/codex-app/`.

### Pi Code

Pi Code uses ephemeral Together settings with persistent sessions. `togetherlink pi` uses Pi's official Together provider (`together`) and a temporary `PI_CODING_AGENT_DIR` for per-run model config, while pointing `PI_CODING_AGENT_SESSION_DIR` at the normal local Pi sessions folder. It does not write Pi config, and Pi sessions can still be resumed normally.

Launch Pi Code through Together:

```bash
export TOGETHER_API_KEY="..."

pnpm -F @togetherlink/cli exec togetherlink pi
pnpm -F @togetherlink/cli exec togetherlink picode
tpi
```

Run Pi Code headlessly through Together:

```bash
pnpm -F @togetherlink/cli exec togetherlink pi -p "Say hi"
tpi -p "Say hi"
```

## Claude Code Headless Smoke Tests

Claude support must be tested headlessly before testing the interactive UI. Headless mode makes proxy failures reproducible and prints a JSON result.

Use debug logs while working on the proxy:

```bash
export TOGETHERLINK_DEBUG=1
```

Basic chat, no tools:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude -- \
  --print \
  --output-format json \
  --no-session-persistence \
  --permission-mode bypassPermissions \
  "Reply with exactly: hi"
```

Expected result:

- The proxy receives `HEAD /`.
- The proxy receives `GET /v1/models?limit=1000`.
- The proxy receives `POST /v1/messages?beta=true`.
- The JSON result has `"is_error": false`.
- The final result is `hi`.

Tool-use smoke test:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude -- \
  --print \
  --output-format json \
  --no-session-persistence \
  --permission-mode bypassPermissions \
  "Read README.md and answer in one sentence what this project does."
```

Expected result:

- The proxy receives at least one request with `toolCount` greater than `0`.
- The debug log shows a `Read` or `Bash` tool call with non-empty JSON arguments.
- Claude Code does not print `Invalid tool parameters`.
- The JSON result has `"is_error": false`.
- The answer is based on the root `README.md`.

Repo-context smoke test:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude -- \
  --print \
  --output-format json \
  --no-session-persistence \
  --permission-mode bypassPermissions \
  "what is this project about?"
```

This broader prompt may take more turns because GLM can overuse tools. It should still finish without a Together API error.

## What These Tests Cover

The basic chat test catches:

- Claude Code model discovery failures.
- Local proxy routing bugs.
- Together model ID problems.
- Basic Anthropic-to-Together message conversion problems.

The tool-use test catches:

- OpenAI function-tool schema conversion bugs.
- Together `tool_calls` to Anthropic `tool_use` conversion bugs.
- Streaming `tool_use` bugs. Claude Code expects tool inputs to arrive as `input_json_delta` events.
- Anthropic `tool_result` to OpenAI `tool` message conversion bugs.

The repo-context test catches:

- Multi-turn tool loops.
- Large tool-result payloads.
- Reasoning preservation across tool calls.

## Direct Together API Probe

When the proxy behavior is unclear, test Together directly before changing the proxy:

```bash
curl https://api.together.ai/v1/chat/completions \
  -H "Authorization: Bearer $TOGETHER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "zai-org/GLM-5.2",
    "messages": [
      { "role": "user", "content": "Reply with exactly: hi" }
    ],
    "reasoning_effort": "high",
    "chat_template_kwargs": { "clear_thinking": false },
    "max_tokens": 256
  }'
```

GLM-5.2 returns preserved reasoning in `choices[0].message.reasoning`. Keep that reasoning unmodified when sending it back in later turns.

## Codex Desktop App-Server Model List Probe

Codex Desktop renders its model picker from the app-server JSON-RPC method `model/list`, not directly from the provider's raw `/v1/models` response. When debugging `togetherlink codex-app`, verify the real app-server contract before changing Desktop config again.

First make sure `~/.codex/config.toml` points at the Togetherlink Codex App provider and that the local Togetherlink daemon is reachable:

```bash
/Applications/Codex.app/Contents/Resources/codex doctor --json
```

If the app-server protocol changed, regenerate the local TypeScript bindings in `/tmp` and inspect the method/parameter shapes:

```bash
/Applications/Codex.app/Contents/Resources/codex app-server generate-ts --out /tmp/codex-app-server-ts
rg "model/list|ModelListParams|InitializeParams|ClientInfo|InitializeCapabilities" /tmp/codex-app-server-ts -g "*.ts"
```

Then query the same app-server mode Desktop uses:

```bash
node --input-type=module -e '
import { spawn } from "node:child_process";

const child = spawn("/Applications/Codex.app/Contents/Resources/codex", ["app-server", "--stdio"], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
let id = 1;
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  }
});

function request(method, params) {
  const requestId = id++;
  child.stdin.write(JSON.stringify({ id: requestId, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(requestId, resolve);
    setTimeout(() => reject(new Error("timeout waiting for " + method)), 10000).unref();
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ method, params }) + "\n");
}

try {
  await request("initialize", {
    clientInfo: {
      name: "togetherlink-debug",
      title: "Togetherlink Debug",
      version: "0.6.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      optOutNotificationMethods: [],
    },
  });

  const response = await request("model/list", { limit: 100, cursor: null, includeHidden: true });
  const models = response.result?.data ?? [];
  console.log(JSON.stringify({
    count: models.length,
    models: models.map((model) => ({
      id: model.id,
      model: model.model,
      displayName: model.displayName,
      hidden: model.hidden,
      isDefault: model.isDefault,
    })),
  }, null, 2));
} finally {
  child.kill("SIGTERM");
}
'
```

Expected result for `togetherlink codex-app` is six visible models, starting with `zai-org/GLM-5.2` and display name `GLM 5.2 · default`. If this probe is correct but Desktop still shows stale or missing models, the bug is in the running Desktop process or frontend state, not the Codex app-server model manager.

Also verify the active Togetherlink daemon session route returns the same catalog without calling Together:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";

const raw = readFileSync(process.env.HOME + "/.codex/config.toml", "utf8");
const baseUrl = raw.match(/base_url\s*=\s*"([^"]+)"/)?.[1];
if (!baseUrl) throw new Error("missing Togetherlink codex-app base_url");

const response = await fetch(baseUrl + "/models");
const body = await response.json();
const models = body.data ?? body.models ?? [];
console.log(JSON.stringify({
  status: response.status,
  count: models.length,
  ids: models.map((model) => model.id ?? model.slug),
}, null, 2));
'
```

Codex Desktop has had a custom-provider picker bug where the frontend hides the model picker unless the provider reports auth as required: https://github.com/openai/codex/issues/10867. `togetherlink codex-app` intentionally writes `requires_openai_auth = true` for the custom provider as a Desktop workaround. If Desktop prompts for login during manual testing, choose API key and enter any placeholder character; model traffic still goes to the configured local Togetherlink `base_url`.

## Notes

The Claude/Codex proxy and per-run Together settings are intentionally temporary. They should not write agent config files. Smoke tests should pass each agent's no-session flag, such as Claude's `--no-session-persistence` or Pi's `--no-session`, unless the behavior under test specifically needs persisted session state.

## Live Agent Gauntlet

The executable live suite is in `packages/tests`. It uses Vitest, real Claude/Codex/Grok/OpenCode/Pi CLI processes, and real Together inference; it does not mock the model provider.

Build once, then run any harness test file:

```bash
node_modules/.bin/tsc -p packages/cli/tsconfig.json
chmod +x packages/cli/dist/bin/togetherlink.js
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Codex.test.ts
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Claude.test.ts
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Grok.test.ts
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/OpenCode.test.ts
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Pi.test.ts
```

Each run writes JSON artifacts to `packages/tests/artifacts/`, including stdout/stderr for every scenario. Longer coding-task scenarios create disposable Git repos under `packages/tests/tmp/` and remove them when the suite finishes.

Current scenarios cover:

- Basic headless response.
- Streaming JSON/event output.
- Shell/read tool usage.
- Claude/Codex multi-step coding tasks in temporary Git repos, including edits and `node --test` verification.
- Long-context pressure with a final checksum assertion.
- Claude and Codex proxy hard context-limit retries with real Together requests that first exceed `input + max_tokens`, then succeed after the proxy lowers `max_tokens`.
- Codex reasoning-stream usage (`reasoning_output_tokens > 0`).
- Grok streaming, terminal tools, usage attribution, and curated model catalog behavior.
- Lighter OpenCode coverage for basic streaming, bash tools, and context pressure.
- Pi Code coverage for streaming JSON, bash tool calls, usage/cost accounting, and Together model-list vision metadata.

## Live Models Check

`packages/tests/src/livemodelscheck.test.ts` is the exhaustive real-inference model check. It is skipped by the normal suite unless `TOGETHERLINK_LIVE_MODELS_CHECK=1` is set, because it launches real Claude Code and Codex CLI sessions and calls Together for every curated model.

Run it with:

```bash
pnpm -F @togetherlink/tests test:live-models-check
```

The check runs one concurrent case per harness/model/probe tuple. Default concurrency is 6 and can be changed with:

```bash
VITEST_MAX_CONCURRENCY=3 pnpm -F @togetherlink/tests test:live-models-check
```

For each curated `SELECTABLE_MODELS` entry it runs both harnesses through:

- Hello-world completion.
- Shell/tool call.
- Subagent delegation (`spawn_agent`/collab tool calls for Codex, `Task`/`Agent` stream events for Claude).

Claude also includes its Haiku-tier backend if it is not already in `SELECTABLE_MODELS`, because Claude Code may use that backend for built-in subagent work.

## GitHub Live Workflow

`.github/workflows/live-agent-gauntlet.yml` runs the same real-inference suite on a daily schedule, on pushes to `main` that touch integration code, and by manual dispatch. It requires a repository secret named `TOGETHER_API_KEY`.

The workflow installs the real agent CLIs explicitly:

```bash
npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai @earendil-works/pi-coding-agent
curl -fsSL https://x.ai/cli/install.sh | bash
```

This is intentionally a CI setup step, not something `togetherlink` does silently on a user's machine.

## Tool Compatibility Audit

The current Claude/Codex tool compatibility notes live in `packages/cli/src/lib/TOOL_COMPATIBILITY.md`. Update that file whenever a new CLI version starts sending a different tool catalog.
