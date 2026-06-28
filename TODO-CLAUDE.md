# Claude Proxy Compatibility TODO

This file tracks concrete compatibility ideas found while comparing our Claude Code proxy with Ollama's Anthropic proxy implementation:

- Reference: https://github.com/ollama/ollama/blob/main/anthropic/anthropic.go
- Local code: `packages/cli/src/lib/claude/proxy.ts`
- Existing broader roadmap: `packages/cli/src/lib/claude/TODO.md`

The goal is not to copy Ollama wholesale. Each item below should be implemented only if it improves Claude Code compatibility or prevents a concrete proxy regression. Every behavior change should include a focused regression test in `packages/tests/src/ClaudeApi.test.ts` unless noted otherwise.

## Priority 1: Fix Native Web Search Detection

Status: not implemented.

Problem:

- Our proxy currently treats a tool named `web_search` as Anthropic native/server web search.
- Anthropic native web-search tools are identified by `type`, for example `web_search_20250305`.
- A user/client tool named `web_search` can therefore be misclassified as a native server tool and executed inside the proxy instead of being returned to Claude Code as a normal `tool_use`.

Desired behavior:

- Detect native Anthropic web search by `tool.type` starting with `web_search`.
- Do not classify a plain custom tool as native web search only because `tool.name === "web_search"`.
- Normalize the upstream function name for native web search to `web_search`.

Regression tests:

- A custom tool with `name: "web_search"` and no native `type` is passed upstream as a normal function tool.
- If the model calls that custom tool, the proxy returns an Anthropic `tool_use` block to Claude Code instead of running the native Exa search loop.
- A native tool with `type: "web_search_20250305"` is still detected and routed through the proxy's native web-search loop.

## Priority 2: Handle Web Search Name Collisions

Status: not implemented.

Problem:

- A request can contain both:
  - Anthropic native web search, identified by `type: "web_search_..."`.
  - A custom/client tool also named `web_search`.
- Both map to the same OpenAI/Together function name, which makes tool-call routing ambiguous.

Desired behavior:

- If a native Anthropic web-search tool is present, avoid exposing a colliding custom/client `web_search` function in the same upstream request.
- Prefer the native server tool because Claude Code expects Anthropic to execute server tools behind the API boundary.
- Emit a debug log when a custom colliding tool is dropped so the behavior is inspectable under `TOGETHERLINK_DEBUG=1`.

Regression tests:

- Given both native `web_search_...` and custom `name: "web_search"` tools, the upstream Together request contains one `web_search` function definition, using the native search schema.
- The dropped custom schema is not sent upstream.
- Non-colliding custom tools remain present.

## Priority 3: Support `server_tool_use` Content Blocks

Status: not implemented.

Problem:

- Ollama explicitly handles Anthropic `server_tool_use` blocks.
- Our converter currently focuses on `text`, `thinking`, `redacted_thinking`, `tool_use`, and `tool_result`.
- If Claude Code sends conversation history containing `server_tool_use`, we may drop or stringify useful state incorrectly.

Desired behavior:

- Treat `server_tool_use` similarly to a tool call when converting Anthropic history into OpenAI/Together messages.
- Preserve:
  - `id`
  - `name`
  - `input`
- Avoid confusing server-side tool calls with Claude Code client tools when deciding whether the proxy should execute them internally.

Regression tests:

- A message containing a `server_tool_use` block is converted into an upstream assistant message with an OpenAI-compatible `tool_calls` entry.
- The tool-call id and input JSON survive the conversion.
- Existing `tool_use` behavior remains unchanged.

## Priority 4: Support `web_search_tool_result` Content Blocks

Status: not implemented.

Problem:

- Anthropic native web search can produce `web_search_tool_result` blocks.
- Ollama formats these blocks into model-readable tool messages.
- Our proxy does not currently have explicit handling for this block shape in the Anthropic-to-OpenAI message conversion.

Desired behavior:

- Convert `web_search_tool_result` blocks into upstream `tool` messages.
- Preserve the `tool_use_id` when present.
- Format result arrays into compact text that keeps at least:
  - title
  - URL
  - error code, if the result is a `web_search_tool_result_error`
- Keep source URLs visible in the converted text so the model can cite them.

Regression tests:

- A `web_search_tool_result` containing result objects becomes a `tool` message with readable title/URL lines.
- A `web_search_tool_result_error` becomes a readable tool-result error message.
- The associated `tool_use_id` is preserved.

## Priority 5: Improve Rich `tool_result.content` Conversion

Status: partially implemented through generic stringification.

Problem:

- Claude Code can send `tool_result.content` as a string or as an array of content blocks.
- Ollama handles text blocks, image blocks, and structured result/error objects more deliberately.
- Our generic stringification is robust enough not to crash, but it may produce poor model context and may miss image-like content nested inside tool results.

Desired behavior:

- Convert `tool_result.content` as follows:
  - string -> same string
  - array of `{ type: "text" }` blocks -> concatenated text
  - array containing image/url blocks -> route through the existing vision-description path or convert to a clear placeholder if vision is not appropriate in this nested context
  - structured objects -> compact JSON or specialized formatting for known Anthropic result/error objects
- Preserve `tool_use_id`.
- Respect `is_error` if present by making the error status visible in the upstream tool message.

Regression tests:

- String tool results still convert exactly as before.
- Array-of-text-block tool results convert to readable text.
- Tool result errors include an explicit error marker in the upstream tool message.
- Nested image/url blocks are not silently dropped.

## Priority 6: Add `stop_sequences` Passthrough

Status: not implemented.

Problem:

- Anthropic uses `stop_sequences`.
- Together/OpenAI-compatible chat completions use `stop`.
- This is a direct compatibility mapping and is less risky than sampling controls.

Desired behavior:

- Add `stop_sequences?: string[]` to the Claude messages request type.
- Pass it upstream as `stop`.
- Apply the same mapping for buffered and streaming requests.
- Include it in trace/cache payload generation so traces reflect the actual upstream request.

Regression tests:

- A request with `stop_sequences: ["</done>"]` sends `stop: ["</done>"]` to Together in buffered mode.
- The same mapping is present in streaming mode.

## Explicitly Deferred: Sampling Fields

Status: intentionally deferred.

Fields:

- `top_p`
- `top_k`
- additional sampling knobs beyond existing `temperature`

Why deferred:

- Claude Code does not appear to rely on these in normal modern flows.
- Recent Anthropic model guidance increasingly pushes effort/thinking-style controls instead of non-default sampling knobs.
- Passing these through may be useful for a general Anthropic-compatible proxy, but it is not a high-value Claude Code compatibility fix unless we observe real Claude Code traffic sending them.

Tracking rule:

- Do not implement `top_p` or `top_k` passthrough unless:
  - debug traces show Claude Code sending them, or
  - we intentionally broaden togetherlink from "Claude Code proxy" toward a more general Anthropic Messages API compatibility layer.

Suggested tests if implemented later:

- Buffered requests pass `top_p` and `top_k` upstream unchanged.
- Streaming requests pass `top_p` and `top_k` upstream unchanged.
- Defaults remain omitted when the client omits them.
