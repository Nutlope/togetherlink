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
6. Re-run a live smoke using the user's original pattern when the bug depends on real Codex, Claude, OpenCode, Pi, or Together behavior.

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

## Notes

The Claude/Codex proxy and per-run Together settings are intentionally temporary. They should not write agent config files. Smoke tests should pass each agent's no-session flag, such as Claude's `--no-session-persistence` or Pi's `--no-session`, unless the behavior under test specifically needs persisted session state.

## Live Agent Gauntlet

The executable live suite is in `packages/tests`. It uses Vitest, real Claude/Codex/OpenCode CLI processes, and real Together inference; it does not mock the model provider.

Build once, then run any harness test file:

```bash
node_modules/.bin/tsc -p packages/cli/tsconfig.json
chmod +x packages/cli/dist/bin/togetherlink.js
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Codex.test.ts
packages/tests/node_modules/.bin/vitest run --config packages/tests/vitest.config.ts packages/tests/src/Claude.test.ts
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
```

This is intentionally a CI setup step, not something `togetherlink` does silently on a user's machine.

## Tool Compatibility Audit

The current Claude/Codex tool compatibility notes live in `packages/cli/src/lib/TOOL_COMPATIBILITY.md`. Update that file whenever a new CLI version starts sending a different tool catalog.
