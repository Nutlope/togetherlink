# Testing

Use these checks when changing the Claude local proxy or CLI launch path.

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

The Claude proxy intentionally runs as an ephemeral local process. It should not write Claude Code config files, and tests should use `--no-session-persistence` unless the behavior under test specifically needs session state.
