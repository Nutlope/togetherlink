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

Web-search smoke test:

```bash
pnpm -F @togetherlink/cli exec togetherlink claude -- \
  --print \
  --output-format json \
  --no-session-persistence \
  --permission-mode bypassPermissions \
  "was there a fifa world cup match yesterday?"
```

Expected result:

- Claude Code may make an internal request with a native Anthropic `web_search_20250305` tool.
- The proxy should execute the lowercase `web_search` tool internally, using Firecrawl search.
- `TOGETHERLINK_DEBUG=1` should show `firecrawl search request` with a non-empty `query`.
- Claude Code should not report `Did 0 searches`.
- The JSON result has `"is_error": false`.

Firecrawl is keyless-first:

- Without `FIRECRAWL_API_KEY`, the proxy calls `https://api.firecrawl.dev/v2/search` with no auth header.
- With `FIRECRAWL_API_KEY`, the proxy sends `Authorization: Bearer $FIRECRAWL_API_KEY`.
- Some environments can receive a keyless Firecrawl `403` because of IP reputation. That is still a valid smoke result if the debug log proves the proxy called Firecrawl and the final answer reports search unavailable instead of inventing results.

Direct native web-search proxy test:

```bash
node --input-type=module <<'EOF'
import { readGlobalConfig, resolveStoredApiKey } from './packages/cli/dist/lib/global-config.js';
import { startClaudeProxy } from './packages/cli/dist/lib/claude/proxy.js';
import { CLAUDE_DEFAULT_MODEL } from './packages/cli/dist/lib/claude/defaults.js';

const config = await readGlobalConfig(process.env.HOME);
const apiKey = resolveStoredApiKey(config.apiKey) || process.env.TOGETHER_API_KEY;
if (!apiKey) throw new Error('No Together API key configured.');
const proxy = await startClaudeProxy({ apiKey, modelId: CLAUDE_DEFAULT_MODEL, debug: true });
try {
  const response = await fetch(`${proxy.url}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_DEFAULT_MODEL,
      max_tokens: 400,
      system: 'You must use the web_search tool for current facts before answering.',
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      messages: [{ role: 'user', content: 'Use web_search to find whether Firecrawl keyless launched in June 2026, then answer with sources.' }]
    })
  });
  console.log(await response.text());
} finally {
  await proxy.close();
}
EOF
```

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

The web-search test catches:

- Native Anthropic server-tool conversion bugs.
- Missing schema for `web_search_20250305`, which can make GLM emit `{}` instead of a search query.
- Firecrawl invocation and clear provider errors when keyless search is unavailable.
- `max_uses` regressions that would otherwise burn provider calls.

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
