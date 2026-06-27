# Claude Proxy TODO

This folder tracks the Claude Code compatibility work for the local Together proxy.

## Current Split

Claude Code sends two broad kinds of tools to the model:

- Client tools: Claude Code executes these locally, then sends `tool_result` back.
- Native/server tools: Anthropic normally executes these inside the Anthropic Messages API backend. Because `togetherlink` replaces Anthropic with a local proxy, we must emulate these ourselves or explicitly mark them unsupported.

Client tools are already mostly supported by converting Anthropic tool schemas to Together/OpenAI function tools, then converting Together `tool_calls` back to Anthropic `tool_use` blocks.

Native/server tools need dedicated local/provider-backed implementations.

## Very Urgent

### `web_search_*`

Status:

- Initial local emulation is implemented in `proxy.ts`.
- The proxy exposes native Anthropic `web_search_*` tools to GLM as function tools, executes GLM's search requests with Exa `/search`, feeds results back to GLM internally, and returns only the final assistant message to Claude Code.
- Exa requires `EXA_API_KEY`; without it the proxy returns a clear error instead of inventing results. The key is sent as `x-api-key: $EXA_API_KEY`.
- `max_uses` is enforced in the proxy so provider failures do not cause unbounded repeated searches.

Why:

- Claude Code already triggers this path through its `WebSearch` tool.
- Without local support, searches can degrade into weak/fake model-only behavior.
- We saw native requests shaped like `web_search_20250305`.

Still needed:

- Add a proper provider abstraction instead of Exa-only logic in `proxy.ts`.
- Add tests around successful Exa responses using mocked fetch.
- Convert Exa results into Anthropic-style citation blocks if Claude Code expects richer citation metadata later.
- Support `user_location`, category/source selection, and richer result limits.
- Decide whether to use Exa's `contents`/`subpages` for scrape/interact flows or keep using REST endpoints directly.

Provider candidates (if Exa ever needs replacing):

- Brave Search API
- Tavily
- SerpAPI
- Bing Web Search

### `web_fetch_*`

Why:

- Claude Code can follow search results with `WebFetch`.
- Anthropic's native fetch is server-side, so our proxy needs an equivalent.

Needed:

- Detect tools where `type` starts with `web_fetch_`.
- Fetch user/search-provided URLs.
- Extract readable HTML text.
- Extract PDF text.
- Enforce domain restrictions.
- Truncate or chunk large pages before sending back to GLM.
- Avoid fetching arbitrary model-invented URLs unless they came from user input or search results.

Provider/library candidates:

- Native `fetch`
- Readability-style HTML extraction
- PDF text extraction library
- Optional browser-backed fetch later for JS-heavy pages

## Important

### `image` / `url` content blocks (vision interception) — IMPLEMENTED

Why:

- GLM-5.2 (`zai-org/GLM-5.2`) is text-only — Together's GLM-5.2 quickstart lists no vision/image capability.
- Claude Code sends images (pasted photos, screenshots, dragged files) as Anthropic `image` content blocks in `/v1/messages`.
- Before this work, the proxy's `toOpenAIMessages` only handled `text`, `thinking`, `tool_use`, and `tool_result` blocks, so an `image` block was silently dropped — only the accompanying text reached GLM-5.2, which answered about an image it never saw.

How it works now (in `proxy.ts` + `vision.ts`):

- `resolveImageBlocks` runs before each `/v1/messages` call. It walks every message's `content` (and the system array), finds `image` and `url` blocks, describes each with a vision model, and replaces the block in place with a `text` block holding the description. GLM-5.2 then reasons over the description rather than the pixels.
- Vision models are **fixed, not user-configurable** — curated for the best experience, with automatic failover from primary to fallback:
  - Primary: `moonshotai/Kimi-K2.7-Code`.
  - Fallback: `Qwen/Qwen3.5-9B`, used if Kimi errors.
- Reasoning is disabled on the vision sub-call (`reasoning: { enabled: false }`, `temperature: 0.6`) because image description is a perception task.
- Descriptions are cached by image hash (per-process), so the same image recurring in conversation history across turns is described once and not re-billed.
- Debug logs (`TOGETHERLINK_DEBUG=1`): `image blocks detected`, `vision describe start/done` with model, length, and a preview.
- Verified end-to-end: GLM-5.2 correctly identified a screenshot as "The Blind Test (theblindtest.io)" and quoted a headline that exists only in the image pixels — proof the description reached the model.

Known limitation / future work:

- The vision sub-call's own token cost is now folded into the proxy's `CostTracker` at the selected vision model's rates.

### `code_execution_*`

Why:

- Anthropic supports server-side code execution and uses it with newer web search/fetch dynamic filtering.
- It is not the same as Claude Code's local `Bash` tool.

Needed:

- Detect tools where `type` starts with `code_execution_`.
- Decide whether to support, block, or map to a local sandbox.
- If supported, run in a real sandbox with strict file/network limits.
- Keep it separate from Claude Code's normal local `Bash`/file tools.

Implementation options:

- Initially mark unsupported with a clear synthetic result.
- Later add Docker/Firecracker/wasm sandbox.
- Never run arbitrary server-code execution directly on the user's machine without an explicit safety design.

### Native tool result loop

Why:

- Anthropic server tools do not require the client to execute `tool_use`.
- Our proxy must run an internal mini-loop: model asks for native tool, proxy executes it, proxy sends result back to GLM, final answer goes to Claude Code.

Needed:

- Add a `server-tools` module.
- Add max-iteration guards.
- Add debug logs for execution, provider, timing, and result count.
- Convert provider results into model-readable tool results.
- Preserve reasoning across internal server-tool turns.

## Medium Priority

### `tool_search_tool_regex_*` and `tool_search_tool_bm25_*`

Why:

- Useful for huge tool catalogs.
- Probably not needed for current Claude Code flows unless Claude Code starts sending deferred tool catalogs.

Needed:

- Detect native tool search types.
- Understand `defer_loading` tool definitions if Claude Code sends them.
- Implement local BM25/regex search over deferred tool schemas.
- Return matching tool references or expand matching tools.

### `advisor_*`

Why:

- Anthropic lists it as a server-side beta tool.
- Unknown whether Claude Code uses it in normal CLI workflows.

Needed:

- Detect and log if it appears.
- Mark unsupported until we see a real request shape.

## Lower Priority

### Dynamic filtering for web tools

Why:

- Newer Anthropic web search/fetch versions can combine with code execution to filter results before adding them to context.
- Nice for quality and token cost, but not required for a first usable proxy.

Needed:

- Only after `web_search_*` and `web_fetch_*` work.
- Decide if filtering happens through GLM, local heuristics, or a sandboxed code step.

### Rich citations

Why:

- Anthropic's native web tools return citation-aware content.
- GLM can cite sources from text, but we should structure results consistently.

Needed:

- Standard result format with title, URL, snippet, fetched text, and timestamp.
- Keep source URLs visible in final context.
- Add tests that the final answer includes source links when web tools run.

## Refactor Status

Moved Claude-specific internals under this folder:

- `../claude-core.ts` -> `./core.ts`
- `../claude-defaults.ts` -> `./defaults.ts`
- `../claude-proxy.ts` -> `./proxy.ts`
- `../harnesses/claude.ts` remains the harness registry entrypoint and imports Claude internals from here.

Suggested future layout:

```text
packages/cli/src/lib/claude/
  TODO.md
  core.ts
  defaults.ts
  proxy.ts
  types.ts
  server-tools/
    index.ts
    web-search.ts
    web-fetch.ts
    code-execution.ts
    tool-search.ts
```

Keep future refactors mechanical and separate from behavior changes.

## Future Additions

### Custom `/togetherlink-feedback` command

Why:

- Claude Code's built-in `/feedback` slash command posts a transcript + bug report straight to a first-party Anthropic endpoint (`api.anthropic.com`, landing in their `claude_cli_feedback` table). It does **not** route through `ANTHROPIC_BASE_URL` / our proxy, so we cannot intercept, capture, or honor it.
- The binary confirms this: it tags third-party providers ("3P provider") as a reason `/feedback` is unavailable, and `unavailable_reason` lists "3P provider, org policy, env var."
- We already disable `/feedback` via `DISABLE_FEEDBACK_COMMAND=1` in `buildClaudeEnv` (`core.ts`). So users currently have no in-session feedback channel at all.

Proposed:

- Ship a custom slash command — e.g. `.claude/commands/togetherlink-feedback.md` (or a user-level command) — so users can type `/togetherlink-feedback <text>` inside a togetherlink session.
- Unlike the built-in `/feedback`, a custom command is fully ours: its body is plain prompt text, so the feedback travels as a normal `/v1/messages` request through our proxy, where it IS interceptable.
- Capture options to decide between:
  - **Local file** (simplest): append the feedback to a `~/.togetherlink/feedback.log` the user can review/share manually. No network, no service.
  - **Together-hosted endpoint** (later): POST to an endpoint we control. Requires a backend + auth; defer until there's a real reason.
- Start with the local-file sink — it's the same scope as the existing `readGlobalConfig`/`writeGlobalConfig` plumbing already used for the Exa key.

Design notes:

- A custom command can't replace the built-in `/feedback` token — that name is owned by the binary and (now) disabled. Pick a distinct name to avoid shadowing confusion.
- Surface the command's existence so users know where feedback goes now that `/feedback` is off: a line in the startup banner / status line (see the banner-in-alt-screen issue) is the natural place.
- Keep it optional behind an env flag (default on), matching the pattern of the other `DISABLE_*` toggles.

Open questions:

- Should the feedback include the session transcript, or only the user's free-text message? The built-in one sends transcripts (privacy-sensitive); a minimal start is free-text only.
- Do we want it grouped per-project or globally? Mirror the memory system's private-vs-team split if we ever add team scope.
