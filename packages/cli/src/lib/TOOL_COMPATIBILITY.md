# Tool Compatibility

Live captures were run with `TOGETHERLINK_DEBUG=1` and a debug-log sink against the terminal Codex and Claude Code harnesses.

## Pricing

- Claude Code: accounted by the daemon-side `CostTracker`. Every proxied Together chat call records `prompt_tokens`, `cached_tokens`, and `completion_tokens` against the selected `ModelDefinition`. Vision description sub-calls are also recorded at the actual vision model's rates.
- Codex: accounted by the same daemon-side `CostTracker`. Both non-streaming and streaming Responses proxy paths request Together usage and record it against the selected Codex model definition, so Codex pricing is handled on this branch.
- OpenCode: model entries include the shared cost metadata, so OpenCode can price locally. togetherlink does not yet print a reliable per-session OpenCode cost summary because OpenCode talks directly to Together and the launcher does not currently self-report session usage into the daemon.

## Codex Terminal

Captured request shape:

- Route: `POST /v1/responses`
- Tool count: 14
- Function tools translated and supported generically:
  - `exec_command`
  - `write_stdin`
  - `list_mcp_resources`
  - `list_mcp_resource_templates`
  - `read_mcp_resource`
  - `update_plan`
  - `request_user_input`
  - `list_available_plugins_to_install`
  - `request_plugin_install`
  - `view_image`

Non-function tools currently not exposed to Together:

- `apply_patch`, type `custom`, raw keys `type,name,description,format`
- `multi_agent_v1`, type `namespace`
- `mcp__codex_apps__botmail__agent_email`, type `namespace`
- anonymous `web_search`, type `web_search`

Risk:

- These ignored tools should not cause an immediate tool-result protocol error because the model never sees them.
- They are still missing capabilities. Codex can fall back to shell edits for many coding tasks, but custom `apply_patch`, namespace tools, and native web search are not faithfully represented yet.

Likely next work:

- Translate Responses `custom` tools into a supported Together tool shape if Codex accepts a returned `function_call` for that tool name, or add a Codex-specific custom-tool event bridge.
- Expand namespace tools into callable function tools with stable names if Codex accepts flattened tool calls.
- Implement or explicitly disable `web_search` in the model catalog. Today the catalog says `supports_search_tool: false`, but Codex still sends a web-search tool in this local environment.

## Claude Code Terminal

Latest headless spot-check: Claude Code `2.1.195` on 2026-06-29.

Captured request shape:

- Route: `POST /v1/messages?beta=true`
- Initial request may have no tools.
- Tool-bearing request had 32 to 33 client tools, all represented as Anthropic-style tools with `name`, `description`, and `input_schema`.

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
- MCP tools such as `mcp__context7__query-docs`, `mcp__context7__resolve-library-id`, and Together docs MCP tools when configured.

Support status:

- Client tools are supported generically: the proxy converts every Anthropic tool schema into an OpenAI/Together function tool, then converts Together `tool_calls` back to Anthropic `tool_use`.
- Captured `WebSearch` and `WebFetch` are client tools, so Claude Code executes them after the proxy returns `tool_use`.
- Native Anthropic server web-search tools are detected by `type` values starting with `web_search`, then normalized to upstream function name `web_search`. A plain custom/client tool with `name: "web_search"` is no longer classified as native only because of its name.
- If a native web-search tool and a custom `name: "web_search"` tool appear in the same request, the proxy keeps the native tool and drops the colliding custom tool from the upstream Together payload.

Headless smoke results:

- Basic `--print --output-format json` completed successfully.
- README `Read` tool prompt completed successfully without `Invalid tool parameters`.
- Forced `WebFetch` completed successfully and returned a streamed `tool_use` with valid `input_json_delta`.
- Forced `WebSearch` completed successfully and returned a streamed client `WebSearch` call. During that run, Claude Code also sent an internal Kimi-tier request containing native `type: "web_search_20250305"`, confirming the native path is live in current Claude Code traffic.
- Re-running through the workspace-built daemon after the streaming native-tool fix showed the internal `web_search_20250305` call being selected, executed inside the proxy via Exa, and continued with a second Together stream request.
- Forced subagent delegation completed successfully with `Agent` and `TaskOutput`; the launch result used rich `tool_result.content` arrays, which are now converted into readable upstream tool messages.

Known gap:

- If Anthropic adds other native server-side tools, the proxy will currently return `"Unsupported native server tool."` inside the internal native-tool loop. No such non-web-search native server tool was observed in this capture.
