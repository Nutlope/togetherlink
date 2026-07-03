# TURN.md — making per-turn proxy overhead O(new content), not O(conversation)

The core product is a fast local hop: Claude Code / Codex → proxy → Together.
Together's model TTFT dominates total latency; everything here is about the
overhead the proxy _adds_ per turn. The design rule that falls out of the
audit:

> **The hot path may serialize the payload exactly once (for the wire), and
> every other per-turn computation must be O(new content) or O(1) — never
> O(conversation).**

Today three things violate that rule, all for the same underlying reason:
estimating input tokens by `JSON.stringify(...).length / 4`.

| Violation                      | Where                                                                                                                                                        | Cost per turn at large context                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude context-budget estimate | `claude/context-budget.ts:74` (`estimatePayloadInputTokens`, called from `applyEstimatedContextBudget` in both `stream.ts:110` and `chat-completions.ts:81`) | Full payload stringify, discarded — the `roughPayloadInputTokens` fast path never fires because Claude Code always sends `tools`                        |
| Codex default max_tokens       | `codex/translate-request.ts:511` (`defaultMaxOutputTokens`)                                                                                                  | Full messages+tools stringify, discarded — fires whenever Codex omits `max_output_tokens`                                                               |
| count_tokens endpoint          | `claude/translate-response.ts:67` (`countTokensResponse`)                                                                                                    | Full `toOpenAIMessages` translation **plus** stringify of the whole conversation, discarded — and Claude Code polls this endpoint for its context gauge |

Plus the wire serialization itself (`JSON.stringify(payload)` in
`claude/stream.ts:522` and `codex/together-call.ts:187`), which is legitimate
but currently duplicates the estimation stringify.

## Why the estimation exists (and must keep existing in some form)

- Together silently defaults an omitted `max_tokens` to 2048 → we must always
  send an explicit value (learned the hard way; see git history).
- Together hard-rejects `input + max_tokens > context window`, and Claude Code
  always requests its full output budget → near the window we must clamp
  `max_tokens` down, or eat a 400 + full re-upload of a multi-MB body.
- The proxy has no tokenizer for GLM/Kimi/etc., so it can only estimate.

The _reason_ is sound. The _signal_ (stringify-and-divide-by-4, recomputed
from scratch every turn) is not.

---

## Part 1 — Replace stringify-based estimation with a self-calibrating byte estimator

### The insight

The proxy already possesses two numbers that make serialization unnecessary:

1. **The inbound request's raw byte length.** `readJsonBody` (`http-util.ts:8`)
   concatenates the request body buffer and throws the length away. The
   Anthropic-JSON size and the translated OpenAI-JSON size track each other
   within a few percent — the content strings, which dominate, are identical.
2. **Ground truth from the previous turn.** Every streamed response carries a
   real `prompt_tokens` in its usage chunk (we force it via
   `stream_options.include_usage`), and `CostTracker` already records it.

Combine them: maintain a per-session **bytes-per-token ratio** — last turn's
raw request bytes ÷ last turn's actual `prompt_tokens` — and estimate the
current turn as `currentRawBytes / ratio`. The estimate self-corrects every
turn against Together's own tokenizer, instead of guessing "4 chars per token"
forever. Cost: two multiplications. No stringify, no translation, ever, for
estimation.

### Changes

**1a. `http-util.ts` — expose raw byte length.**

```ts
export async function readJsonBodyWithSize(
  req: IncomingMessage,
): Promise<{ body: unknown; rawBytes: number }>;
```

Keep `readJsonBody` as a thin wrapper so nothing else changes. Both proxies
switch their `/v1/messages` and `/v1/responses` handlers to the sized variant.

**1b. `claude/cost.ts` — record calibration data.**

`CostTracker.addUsage` already receives real `prompt_tokens` per request. Add:

- `noteRequestBytes(rawBytes: number)` — called by the proxy at request start.
- `get tokenEstimator(): { estimate(bytes: number): number }` — returns the
  calibrated ratio when at least one turn of ground truth exists, else falls
  back to `APPROX_CHARS_PER_TOKEN` (4). Guard against degenerate ratios
  (vision sub-calls, tool-loop multi-call turns: calibrate on the _first_
  Together call of a request only, which corresponds 1:1 to the inbound body).

The estimator lives on `CostTracker` because it is already the per-session
object that sees both sides (inbound requests and Together usage), is already
threaded into both proxies' options, and is already persisted per-session by
the daemon.

**1c. `claude/context-budget.ts` — `applyEstimatedContextBudget` takes an
estimate, not a payload to serialize.**

New signature: callers pass `estimatedInputTokens` (from
`costTracker.tokenEstimator.estimate(rawBytes)`). Internals:

- Delete `estimatePayloadInputTokens`, `roughPayloadInputTokens`,
  `jsonByteLength` from the per-turn path (`jsonByteLength` survives only if
  the trim path still wants a post-trim recount — see 1e).
- **Gate the whole computation**: if
  `estimatedInputTokens × 1.15 + max_tokens + safety < context window`, return
  immediately. On the ~95% of turns where the session is nowhere near the
  window, the budget check is now two comparisons.
- Near the window, clamp exactly as today. The reactive 400-retry
  (`maxTokensForContextLengthRetry`) remains the accuracy backstop — it parses
  Together's _exact_ token counts from the error message.

**1d. `codex/translate-request.ts` — same treatment for
`defaultMaxOutputTokens`.**

Thread `rawBytes` + the session `CostTracker` estimator into `toChatPayload`
(the codex proxy already holds both at the call site, `codex/proxy.ts:71`).
Delete the stringify at line 511-513. Same gate: full output budget unless the
estimate says the window is close.

**1e. Trim becomes an alarm, not a feature.**

`trimPayloadInputForContextLengthRetry` stays — as the last resort before
surfacing a hard error mid-session — but:

- Emit a telemetry event (`telemetry.ts`) and an always-on (not debug-gated)
  stderr warning when it fires. Compaction is the harness's job; the trim
  firing means our advertised limits (`/v1/models`) or `count_tokens` numbers
  let Claude Code compact too late. Every firing is a bug report against 1f.
- If the post-trim recount needs `jsonByteLength`, that's fine — this path is
  exceptional by construction.

**1f. `count_tokens` answers from the estimator.**

`countTokensResponse` currently re-translates and stringifies the entire
conversation on an endpoint Claude Code polls routinely. Replace with:
`estimator.estimate(rawBytes)` of the count_tokens request body itself (the
handler gets `rawBytes` from 1a). This makes Claude Code's context gauge
_more_ accurate (calibrated against Together's real tokenizer instead of ÷4),
which directly improves compaction timing — the root-cause fix that keeps the
trim path cold.

**1g. Serialize once for the wire.**

In `claude/stream.ts` `postTogetherStream` and both `together-call.ts` retry
loops: `JSON.stringify(payload)` once into a local, reuse the string across
retry attempts (only the trim/clamp retry paths mutate the payload — those
re-stringify, and they are rare by construction). With estimation no longer
serializing, each turn now stringifies the payload exactly once total.

### Tests

- Unit: estimator calibration (ratio convergence over synthetic turns;
  fallback with no history; degenerate-ratio guards); gate arithmetic
  (`context-budget` clamps at the boundary, no-ops far from it); count_tokens
  monotonicity with body size.
- Existing `ClaudeApi.test.ts` / `CodexProxyApi.test.ts` round-trips must pass
  unchanged; `pnpm capture:proxy-fixtures` byte-identical on the happy path.
- `pnpm bench:proxy` before/after at a large-context fixture — this change
  should show up directly in the `translate_request` → `upstream_fetch` gap.
- One live gauntlet run: drive a session past the context window and verify
  the clamp + reactive retry still recover (and the trim warning fires with
  telemetry when forced).

---

## Part 2 — Other per-turn work the scan flagged

**2a. `writeSse` issues two `res.write` calls per event** (`sse.ts:115`).
With `setNoDelay(true)` each write can flush as its own packet, and a long
response emits hundreds of events through `StreamBlockManager` and the codex
output-item writers. Concatenate to one write:
`res.write(`event: ${event}\ndata: ${json}\n\n`)`. Halves syscalls/packets for
every delta of every turn on both proxies.

**2b. `readSseChunk` allocates a `Promise.race` + `setTimeout` per upstream
chunk** (`sse.ts:94`, used by the codex idle watchdog — hundreds of
allocations per turn). Replace with one persistent watchdog timer per stream
that each chunk arrival resets (`timer.refresh()` in Node). Do it while
touching `sse.ts` for 2a.

**2c. Duplicated translate block in `claude/stream.ts:53-91`.** The
`perf?.spanSync(...) ?? fallback` pattern pastes the entire translation twice.
Not a perf bug (it runs once), but it's the hot path's most-edited code —
extract to a local `translate()` and call it through `spanSync` or directly.
The codex proxy already does this correctly (`codex/proxy.ts:71`).

**2d. Verify upstream connection reuse (network, possibly the biggest
real-world number).** Both proxies use bare global `fetch`. Under Node/undici
the keep-alive idle timeout defaults to ~4s; turns are almost always >4s
apart, so every turn may pay ~200ms of TCP+TLS to `api.together.ai` before
uploading a multi-MB body. Add connect-timing to the perf tracer
(undici `diagnostics_channel` connect events; measure under Bun too, since the
installed bundle runs on Bun), and if handshakes recur per turn: explicit
dispatcher/pool with long keep-alive + pre-warm at session registration.
Optionally warm the connection while `readJsonBody` is still draining the
inbound body — the POST headers already announce a turn is coming.

**2e. Experiment: gzip the upload.** Each turn re-uploads the entire
conversation as uncompressed JSON; on residential uplinks a 4MB body is >1s
before prefill starts. If Together accepts `Content-Encoding: gzip` request
bodies, that's 4–8× off the dominant byte cost. Flag-gated experiment with
automatic fallback on 4xx/415. (Independent of Part 1; only worth doing after
2d confirms connections are otherwise healthy.)

## Scanned and deliberately left alone

- **Vision image resolution** — LRU-cached across requests by content hash,
  gated to requests that actually contain image blocks. Correct as is.
  `extractImageBlocks` walks all blocks per turn but allocates nothing per
  block and never serializes; not worth touching.
- **Debug logging** — properly gated (`writeProxyDebugLog` checks
  `options.debug` before evaluating lazy closures) and fire-and-forget async.
- **Daemon routing** — token → session is a `Map` lookup; `markSeen`
  persistence is interval-throttled. No per-turn disk I/O on the hot path.
- **SSE inbound parsing** — `consumeSseLines`/`findSseBoundary` are
  index-based, O(chunk). Fine.
- **Translation prefix caching** (memoizing `toOpenAIMessages` for the
  append-only history) — the biggest theoretical CPU win left after Part 1,
  but system-merging and tool-pairing cross message boundaries, so it's the
  riskiest change for the smallest confirmed number. Revisit only if perf
  traces still show `translate_request` as material after Part 1 lands.
- **Retry/backoff loops** — only run on 429/503/context errors; off the happy
  path by construction.

## Order of work

1. **1a–1c + 1f** (claude estimator + gate + count_tokens) — one PR; biggest
   CPU win, and count_tokens accuracy improves compaction timing system-wide.
2. **1d** (codex estimator) — small PR on the same primitives.
3. **1g + 2a + 2b + 2c** (serialize-once, SSE write merge, watchdog timer,
   translate dedup) — one mechanical PR.
4. **1e** (trim telemetry/alarm) — small PR, adds the regression tripwire.
5. **2d** (connection reuse measurement → fix) — measure first, then decide.
6. **2e** (gzip experiment) — last, behind a flag, only if 2d looks healthy.

Every PR: `pnpm typecheck && pnpm test && pnpm bench:proxy`, fixture capture
diff, and a live `test:gauntlet:core` run before merge.
