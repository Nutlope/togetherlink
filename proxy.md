# Plan: Splitting the proxy monoliths

Goal: break `packages/cli/src/lib/claude/proxy.ts` (~2,860 lines) and
`packages/cli/src/lib/codex/proxy.ts` (~2,170 lines) into focused modules,
eliminate the code duplicated between them, and leave each `proxy.ts` as a thin
request-handler that wires the pieces together.

**Ground rules**

- Every phase is a pure code move: no behavior changes, no signature changes to
  the public entry points (`handleProxyRequest`, `handleCodexProxyRequest`).
- One phase per PR. After each phase: `pnpm typecheck`, `pnpm test`, and
  `pnpm bench:proxy` must pass; the captured fixtures
  (`pnpm capture:proxy-fixtures`) must produce identical output.
- Do **not** build a shared Anthropic↔Responses "translator framework". The two
  protocols differ in real ways (thinking blocks vs reasoning items, stream
  event grammars, tool result shapes). Share only code that is genuinely
  protocol-agnostic.

**Current external consumers** (their imports must keep working, via re-exports
during migration if needed):

| Importer                                                                         | Pulls from                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daemon/server.ts`                                                               | `claude/proxy.js`: `handleProxyRequest`, `requestPath`, `readJsonBody`, `writeJson`, `writeAnthropicError`, `isTogetherApiError`, `extractToken`; `codex/proxy.js`: `handleCodexProxyRequest` |
| `daemon/state.ts`                                                                | `claude/proxy.js`: `ClaudeProxyOptions`, `ModelDefinition` (types); `codex/proxy.js`: `CodexProxyOptions` (type)                                                                              |
| `codex/proxy.ts`                                                                 | `claude/proxy.js`: `readJsonBody`, `requestPath`, `writeJson` ← cross-harness dependency, removed in Phase 1                                                                                  |
| `packages/tests` (`ClaudeApi.test.ts`, `CodexProxyApi.test.ts`, both benchmarks) | `handleProxyRequest`, `ClaudeProxyOptions`, `ModelDefinition`, `handleCodexProxyRequest`                                                                                                      |

---

## Phase 1 — extract the shared, protocol-agnostic layer

New modules under `packages/cli/src/lib/`:

### 1a. `lib/http-util.ts`

Generic Node HTTP helpers currently living in `claude/proxy.ts` but used by the
daemon and the codex proxy:

- `requestPath` (proxy.ts:2468)
- `readJsonBody` (proxy.ts:2472)
- `writeJson` (proxy.ts:2427)
- `extractToken` (proxy.ts:655)
- `isAuthorized` / `constantTimeEqual` (proxy.ts:665, 670)

Update `daemon/server.ts` and `codex/proxy.ts` to import from `lib/http-util.js`
directly. This kills the `codex → claude` cross-dependency. Keep re-exports in
`claude/proxy.ts` for one release so nothing external breaks, then drop them.

### 1b. `lib/sse.ts`

SSE plumbing duplicated in both proxies:

- `findSseBoundary` (claude:2215, codex:1986)
- `consumeSseLines` (claude:2199)
- `sseDataPayload` / `sseEventPayload` (claude:2242, codex:2001)
- `readSseChunk` (codex:1932)
- `writeSse` (claude:2422) and the codex per-response sequence-number writer
  (`responseSequenceNumbers` WeakMap, codex:207)

The two `findSseBoundary` implementations must be diffed first; if they differ,
keep the union of behaviors under test before unifying.

### 1c. `lib/together-retry.ts`

Retry/backoff plumbing duplicated verbatim:

- `parseRetryAfter` (claude:1140, codex:562)
- `backoffMs` (claude:1156, codex:577)
- `sleep` (claude:1164, codex:583)

Deliberately **not** merging `fetchTogether` (claude:987) with
`fetchTogetherChat`/`postTogetherChat` (codex:495/523) in this phase — they have
different error-mapping and timeout semantics. Revisit only after Phase 2 makes
both readable.

### 1d. `lib/exa-search.ts`

The Exa web-search implementation, ~100 lines duplicated per file:

- `runExaSearch` (claude:1272, codex:895)
- `webSearchQuery` (claude:1347, codex:971)
- `stringArray` (claude:1360, codex:992)
- `trimSearchText` (claude:1366, codex:988)
- `withNativeToolSystemPrompt` (claude:1257, codex:875)
- `nativeToolMaxUses` (claude:1251, codex:890)

The copies differ only in the tool/options input types. Shared signature takes
plain data instead of harness types:

```ts
runExaSearch(params: {
  query: unknown;
  allowedDomains: string[];
  blockedDomains: string[];
  exaApiKey: string | undefined;
}): Promise<string>
```

Each proxy keeps a ~5-line adapter that destructures its own tool type.

**New unit tests** (in `packages/tests`): SSE boundary/payload parsing,
`parseRetryAfter`/`backoffMs`, Exa query extraction and domain filtering. These
are pure functions — cheap to test, and today they're only covered indirectly
through full proxy round-trips.

Expected shrink: roughly −250 lines from each proxy.

---

## Phase 2 — split `claude/proxy.ts` along its internal seams

New modules under `packages/cli/src/lib/claude/`:

| Module                  | Contents (current lines)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wire-types.ts`         | The Anthropic wire types at the top of the file: `AnthropicContentBlock`, `AnthropicMessage`, `AnthropicMessagesRequest`, `AnthropicCountTokensRequest`, `AnthropicTool`, `NativeServerTool`, `OpenAITool`, `OpenAIMessage`, etc. (≈ lines 23–170)                                                                                                                                                                                                                                                                                                                  |
| `context-budget.ts`     | The max_tokens / context-length cluster: `clampRequestedMaxTokens` (169), `maxTokensForContextLengthRetry` (179), `applyEstimatedContextBudget` (205), `estimatePayloadInputTokens` (260), `roughPayloadInputTokens` (273), `jsonByteLength` (295), `trimPayloadInputByApproxTokens` (299), `canTrimInputForContextLengthRetry` (333), `parseTogetherContextLengthMaxTokens` (345), `parseTogetherContextLengthInputTokens` (350), `parseTokenCount` (361), `safeClaudeInputLimit` (369), `trimPayloadInputForContextLengthRetry` (575), `trimOldContextText` (618) |
| `translate-request.ts`  | Anthropic→OpenAI mapping: `toOpenAIMessages` (1370), `mergeLeadingSystemMessages` (1439), `toOpenAITools` (1168), `openAIToolName` (1197), `toOpenAIToolParameters` (1201), `toOpenAIToolChoice` (1221), `nativeServerTools` (1238), `isNativeWebSearchTool` (1247), `togetherReasoningEffort` (941), `normalizeTogetherReasoningEffort` (964)                                                                                                                                                                                                                      |
| `translate-response.ts` | OpenAI→Anthropic mapping for non-stream paths: `toAnthropicMessage` (1455), `thinkingSignature` (639), `asOpenAIMessageRecord` (643), `countTokensResponse` (914), `claudeModelResponse` (902), `resolveTargetModel` (876), `findClaudeModel` (886)                                                                                                                                                                                                                                                                                                                 |
| `together-call.ts`      | The Together HTTP layer: `callTogetherChatCompletions` (682), `fetchTogether` (987), `mapTogetherError` (1062), `mapStatusToAnthropicError` (1112), `TogetherApiError` type, `isTogetherApiError` (2445), `writeAnthropicError` (2432)                                                                                                                                                                                                                                                                                                                              |
| `stream.ts`             | Streaming translation: `streamAnthropicFromTogether` (1513), `streamAnthropicNativeToolLoop` (1860), `collectTogetherStreamTurn` (2028), `emitCollectedStreamTurn` (2111), `parseStreamData` (2149), `StreamBlockManager` (2277)                                                                                                                                                                                                                                                                                                                                    |
| `proxy.ts` (remains)    | `handleProxyRequest`, `ClaudeProxyOptions`, auth wiring, route dispatch, cost-tracker/perf-tracer hookup — target ≈ 300–400 lines                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Migration order within the phase (each step compiles and passes tests):

1. `wire-types.ts` (leaf, no logic)
2. `context-budget.ts` (pure functions over payload records)
3. `translate-request.ts` + `translate-response.ts`
4. `together-call.ts`
5. `stream.ts` (largest; `streamAnthropicFromTogether` alone is ~350 lines)

`proxy.ts` re-exports everything it exported before (`ClaudeProxyOptions`,
`ModelDefinition`, `handleProxyRequest`, `countTokensResponse`,
`writeAnthropicError`, `isTogetherApiError`, plus the Phase-1 http-util
re-exports until consumers migrate), so `daemon/*`, tests, and benchmarks need
no changes in this phase.

**New unit tests**: `context-budget.ts` is the priority — it encodes the
hardest-won behavior in the repo (Together's silent 2048 max_tokens default,
context-length retry trimming) and today is only exercised through end-to-end
fixtures. Direct tests on `parseTogetherContextLengthMaxTokens` /
`applyEstimatedContextBudget` / `trimPayloadInputByApproxTokens` against real
Together error strings.

---

## Phase 3 — mirror the split for `codex/proxy.ts`

Same shape, under `packages/cli/src/lib/codex/`:

| Module                  | Contents (current lines)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wire-types.ts`         | `ResponsesRequest`, `ResponsesTool`, `ResponsesInputItem`, `ResponsesTextConfig`, `ChatMessage`, `CodexToolTranslation`, `PendingToolCall`, `StreamOutputState`, etc.                                                                                                                                                                                                                                                                                                                                                                                      |
| `translate-request.ts`  | `toChatPayload` (587), `toChatMessages` (651), `toChatHistoryToolName` (721), `translateCodexTools` (745), `toChatFunctionTool` (837), `sanitizeToolName` (852), `customToolDescription` (857), `isWebSearchTool` (867), `toChatRole` (998), `stringifyResponsesContent` (1008), `toChatMessageContent` (1023), `toChatToolChoice` (1055), `toChatToolChoiceName` (1075), `toChatResponseFormat` (1087), `reasoningEffort` (1108), `resolveCodexRequestModel` (617), `isCodexMemoryRequest` (644)                                                          |
| `translate-response.ts` | `toResponsesResponse` (1128), `toResponsesOutput` (1146), the output-item builders: `openReasoningOutputItem` (1763), `openTextOutputItem` (1783), `reasoningOutputItem` (1811), `messageOutputItem` (1824), `responseToolCallOutputItem` (1837), `functionCallOutputItem` (1872), `customToolInput` (1883)                                                                                                                                                                                                                                                |
| `together-call.ts`      | `callTogether` (374), `callTogetherWithNativeTools` (387), `fetchTogetherChat` (495), `postTogetherChat` (523)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `stream.ts`             | `streamResponseFromTogether` (1179), `streamTogetherTurn` (1276), `streamResponseWithNativeTools` (1405), `streamTogetherTurnWithIdleRetries` (1548), `runNativeToolCalls` (1597), `completeOpenOutputItems` (1625), `completeStreamResponse` (1664), `failStream` (1721), `mergeUsage` (1736), `streamOutputStarted` (1593), the idle/turn timeout cluster: `SseIdleTimeoutError` (223), `assertStreamProgress` (1393), `assertStreamTurnDuration` (1399), `codexStreamIdleTimeoutMs` / `codexStreamTurnTimeoutMs` / `codexStreamIdleRetries` (1951–1967) |
| `proxy.ts` (remains)    | `handleCodexProxyRequest`, `CodexProxyOptions`, route dispatch — target ≈ 250–350 lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

The codex stream module's idle-retry/timeout cluster deserves its own unit
tests — it's the defense against Together stalls and currently only fails
observably in live runs.

---

## Phase 4 — cleanup

- Drop the temporary re-exports from both `proxy.ts` files; point
  `daemon/server.ts`, `daemon/state.ts`, tests, and benchmarks at the final
  module paths.
- Diff `claude/together-call.ts` vs `codex/together-call.ts`; if the retry
  loops converged during extraction, merge into `lib/together-client.ts` — but
  only if genuinely identical, per the ground rules.
- Update `TESTING.md` if it references file paths that moved.

## Explicit non-goals

- No shared abstraction over Anthropic↔Responses protocol translation.
- No changes to daemon session handling, model resolution, or cost tracking.
- No renaming of the public entry points or option types.

## Verification checklist (every phase)

```bash
pnpm typecheck
pnpm test                      # includes ClaudeApi / CodexProxyApi round-trips
pnpm bench:proxy               # catches perf regressions from the move
pnpm capture:proxy-fixtures    # output must be byte-identical
```

Plus one live gauntlet run (`test:gauntlet:core`) before merging each phase.
