# Tool Compatibility

Live captures were run with `TOGETHERLINK_DEBUG=1` and a debug-log sink against the terminal Codex and Claude Code harnesses. The latest compatibility pass used Codex CLI `0.144.6` and Claude Code `2.1.215` on 2026-07-20.

Source changelogs: [Codex](https://learn.chatgpt.com/docs/changelog) and [Claude Code](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

## Pricing

- Claude Code: accounted by the daemon-side `CostTracker`. Every proxied Together chat call records `prompt_tokens`, `cached_tokens`, and `completion_tokens` against the selected `ModelDefinition`. Vision description sub-calls are also recorded at the actual vision model's rates.
- Codex: accounted by the same daemon-side `CostTracker`. Both non-streaming and streaming Responses proxy paths request Together usage and record it against the selected Codex model definition, so Codex pricing is handled on this branch.
- OpenCode: model entries include the shared cost metadata, so OpenCode can price locally. togetherlink does not yet print a reliable per-session OpenCode cost summary because OpenCode talks directly to Together and the launcher does not currently self-report session usage into the daemon.

## Codex Terminal

Captured request shape:

- Route: `POST /v1/responses`
- Tool count: 21 in the latest headless capture
- Function tools translated and supported generically:
  - `exec_command`
  - `write_stdin`
  - `list_mcp_resources`
  - `list_mcp_resource_templates`
  - `read_mcp_resource`
  - `update_plan`
  - `request_user_input`
  - `request_plugin_install`
  - `view_image`

Non-function support:

- Responses `custom` tools are wrapped as Together function tools and restored as `custom_tool_call` items. A live `apply_patch` run created the exact requested file without falling back to shell commands.
- Responses `namespace` tools are flattened with stable names for Together and restored with their original namespace. A live `multi_agent_v1.spawn_agent` run returned both the child and parent markers.
- Codex tool search is advertised for tool-capable models. The proxy maps `tool_search` through Together function calling, restores the client-executed `tool_search_call`, and loads only definitions returned in `tool_search_output` on continuation turns. Unselected `defer_loading` tools stay out of the Together payload.
- Native Responses `web_search` is exposed when Codex is launched with `--search`. The proxy executes it through Exa and continues the Together turn internally. A live search reached Exa and returned the expected Together AI homepage title.

Memory support:

- Codex extraction requests for `gpt-5.4-mini` and consolidation requests carrying the `## Memory Writing Agent:` instructions are routed to the configurable Together memory model (`TOGETHERLINK_CODEX_MEMORY_MODEL`, default MiniMax M3).
- The real Codex memory database contained successful `source=cli, model_provider=togetherlink` stage-one jobs and no failed tcodex CLI jobs. A headless tcodex retrieval then searched `MEMORY.md` and returned the correct prior-session evidence.
- `codex exec` can consume memories but is not itself eligible to generate a future memory. Upstream Codex restricts extraction candidates to interactive session sources and waits for the configured idle window.
- The injected `MEMORY_SUMMARY` can omit middle sections when Codex truncates a large summary. Retrieval should fall through to the memory registry rather than treating the summary as exhaustive.

Recent Codex changelog impact:

- `0.144.6` corrected OpenAI model context metadata to 272k. TogetherLink uses its own generated catalog and each Together model's real context limit, so no catalog change is required.
- Tool search is client-owned but needs a faithful Responses bridge. A live `0.144.6` run began with 12 tools including `tool_search` and no MCP namespace schemas, discovered `openaiDeveloperDocs.search_openai_docs`, called it, and completed successfully.
- Remote plugins and interactive MCP authentication remain client-owned. Once available to Codex, their tools use the same direct or deferred proxy paths.
- Memories remain experimental but enabled in the tested CLI. TogetherLink's existing memory-model routing is still required and works with current traffic.

## Claude Code Terminal

Latest headless spot-check: Claude Code `2.1.215` on 2026-07-20.

Captured request shape:

- Route: `POST /v1/messages?beta=true`
- Initial request may have no tools.
- The isolated baseline request had 28 client tools, all represented as Anthropic-style tools with `name`, `description`, and `input_schema`. Configured MCP servers add more tools.

Observed client tools:

- `Agent`
- `Bash`
- `CronCreate`
- `CronDelete`
- `CronList`
- `DesignSync`
- `Edit`
- `EnterWorktree`
- `ExitWorktree`
- `ListMcpResourcesTool`
- `Monitor`
- `NotebookEdit`
- `PushNotification`
- `Read`
- `ReportFindings`
- `ReadMcpResourceDirTool`
- `ReadMcpResourceTool`
- `ScheduleWakeup`
- `SendMessage`
- `Skill`
- `TaskCreate`
- `TaskGet`
- `TaskList`
- `TaskOutput`
- `TaskStop`
- `TaskUpdate`
- `WaitForMcpServers`
- `WebFetch`
- `WebSearch`
- `Workflow`
- `Write`
- MCP tools are included generically when configured.

Support status:

- Client tools are supported generically: the proxy converts every Anthropic tool schema into an OpenAI/Together function tool, then converts Together `tool_calls` back to Anthropic `tool_use`.
- TogetherLink explicitly sets `ENABLE_TOOL_SEARCH=true` because Claude Code disables MCP tool search for custom `ANTHROPIC_BASE_URL` proxies by default. Users can still override it with `false`, `auto`, or `auto:N`.
- Claude Code owns catalog search and tool selection. The proxy passes `ToolSearch` as an ordinary callable tool, accepts the selected `defer_loading` schemas on later turns, and renders `tool_reference` history as compact text rather than raw protocol JSON.
- Captured `WebSearch` and `WebFetch` are client tools, so Claude Code executes them after the proxy returns `tool_use`.
- Native Anthropic server web-search tools are detected by `type` values starting with `web_search`, then normalized to upstream function name `web_search`. A plain custom/client tool with `name: "web_search"` is no longer classified as native only because of its name.
- If a native web-search tool and a custom `name: "web_search"` tool appear in the same request, the proxy keeps the native tool and drops the colliding custom tool from the upstream Together payload.

Headless smoke results:

- Basic `--print --output-format stream-json --include-partial-messages` completed successfully with final usage and cost accounting.
- README `Read` tool prompt completed successfully without `Invalid tool parameters`.
- Forced `WebFetch` completed successfully and returned a streamed `tool_use` with valid `input_json_delta`.
- Forced `WebSearch` completed successfully and returned a streamed client `WebSearch` call. During that run, Claude Code also sent an internal Kimi-tier request containing native `type: "web_search_20250305"`, confirming the native path is live in current Claude Code traffic.
- Re-running through the workspace-built daemon after the streaming native-tool fix showed the internal `web_search_20250305` call being selected, executed inside the proxy via Exa, and continued with a second Together stream request.
- Forced subagent delegation completed successfully with `Agent` and `TaskOutput`; the launch result used rich `tool_result.content` arrays, which are now converted into readable upstream tool messages.
- Claude Code `2.1.215` with `--forward-subagent-text` streamed the child marker and returned the parent marker successfully.
- Claude Code `--bg` originally reproduced a real lifecycle bug: the launcher exited, TogetherLink deleted the daemon route, and the detached worker retried `401 Unauthorized local proxy request`. Successful background launches now keep a no-pid daemon route; the live fixed run completed and accrued daemon-side cost. Failed background launches still clean up immediately. Existing daemon limits reap no-pid routes after 24 hours idle and cap them at 50.
- The workspace build completed a forced Context7 discovery and returned `/colinhacks/zod`. The first Together request fell from 42 tools and 29,509 input tokens with search disabled to 11 tools and 13,755 input tokens with search enabled, a 53% reduction. The discovery added one round trip; later requests carried only the selected schemas (17 tools in this run), so the benefit grows with larger catalogs and longer sessions.

Recent Claude Code changelog impact:

- `EndConversation` is a new conditional client tool. It was not offered in the benign baseline request; when offered, its ordinary Anthropic client-tool schema goes through the generic tool bridge.
- Progress heartbeats, memory-frontmatter timestamp/heading fixes, `/fork` source metadata, and subagent status-line effort are Claude Code client behavior and require no proxy feature flag.
- The upstream stream-JSON drain and cumulative-usage fixes improve TogetherLink sessions without a translation change; current stream JSON and cost accounting passed live.
- `--forward-subagent-text` required no proxy change. `--bg` did require the launcher-lifecycle fix above.

Known gap:

- If Anthropic adds other native server-side tools, the proxy will currently return `"Unsupported native server tool."` inside the internal native-tool loop. No such non-web-search native server tool was observed in this capture.

## Additional audit follow-ups

- Grok Build sometimes overrode the old generic identity rule and claimed the selected GLM backend was Grok built by xAI. TogetherLink now injects the exact selected Together backend and explicitly distinguishes it from the terminal harness; the live identity probe passed three consecutive runs.
- One OpenCode long-context run selected the first checksum instead of the final checksum despite receiving the full prompt and returning no context error. The unchanged scenario passed on rerun; its prompt now restates the final record position after the record block so it measures retained tail context with less model-choice variance.
