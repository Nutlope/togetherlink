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

Why:

- Claude Code already triggers this path through its `WebSearch` tool.
- Without local support, searches can degrade into weak/fake model-only behavior.
- We saw native requests shaped like `web_search_20250305`.

Needed:

- Detect tools where `type` starts with `web_search_`.
- Execute search through a configurable provider.
- Return compact, cited search results to GLM.
- Support `query`, `allowed_domains`, `blocked_domains`, `max_uses`, and result limits where possible.
- Add a smoke test that proves the proxy actually executed a provider search, not just shaped a query.

Provider candidates:

- Brave Search API
- Tavily
- SerpAPI
- Bing Web Search
- Exa

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

### Launch target preference: terminal vs desktop

Why:

- `togetherlink configure` can ask whether the user prefers launching Claude through the terminal CLI or a native macOS desktop app.
- This should be a `togetherlink` preference, not a persistent Claude Code `on/off` modification.
- Users should not need to remember different commands if they usually prefer one surface.

Needed:

- Add a global config field such as `harnesses.claude.launchTarget`.
- Prompt during `togetherlink configure`:
  - `terminal`: default and safest; launch `claude` CLI with local proxy env.
  - `desktop`: experimental on macOS; launch a Claude app process with local proxy env if supported.
- Add explicit flags to override the saved default:
  - `togetherlink claude --target terminal`
  - `togetherlink claude --target desktop`
- Keep `terminal` as the default until desktop is verified end-to-end.

Open questions:

- Which app should be launched: Claude Desktop consumer app, Claude Code desktop surface, or another Anthropic app bundle?
- Does the installed app honor `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`, and `ANTHROPIC_CUSTOM_MODEL_OPTION`?
- Does it use the same `/v1/messages` protocol as Claude Code CLI?
- Does it support custom model discovery through `/v1/models`?

macOS launch options to test:

- Spawn the app executable directly with env, for example `/Applications/Claude.app/Contents/MacOS/...`.
- Use `open -a Claude` only if env propagation is verified.
- Avoid `launchctl setenv` for ephemeral mode unless the user explicitly asks for persistent desktop routing, because it changes the broader GUI session environment.

Risks:

- Native desktop apps launched through Finder or `open` may not inherit terminal env vars.
- Consumer Claude Desktop may use app auth/session behavior instead of API-token routing.
- If the desktop app ignores custom endpoint env vars, the CLI cannot force the proxy without lower-level traffic interception, which we should not do.

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
