# togetherlink Performance & Speed Ideas

**Goal**: Make togetherlink faster where it actually moves the needle for users, while preserving correctness (tool behavior, cost tracking, image descriptions, streaming fidelity, context handling).

**Current experimental reality** (from `proxy-performance.bench.ts` runs):

- For _large synthetic payloads_, local proxy overhead is ~3-5 ms (p95), with JSON parse + stringify dominating the in-process time.
- For _captured real headless coding sessions_, the numbers are already very low: Codex p95 ~0.34 ms, Claude p95 ~1.22 ms.
- This implies that for typical usage, **real TTFT, upstream network latency, vision model calls, and Exa searches** are likely far more impactful than further shrinking local translation cost.

### Benchmark Evidence

- **Command**: `pnpm bench:proxy`
- **Date**: 2026-06-30
- **Note**: mocked upstream, measures local proxy translation overhead only (no real Together latency)
- **Key p95 results** (approximate, from latest run):
  - Large synthetic (codex/claude buffered): 3–5 ms proxy overhead
  - Captured real Codex headless: ~0.34 ms
  - Captured real Claude headless: ~1.22 ms
  - JSON parse/stringify accounts for most of the in-process time on large payloads.

### Experiment Results

- **Keep-alive dispatcher attempt**: reverted. A local timing validation that routed Node `fetch` through an external Undici `Agent` failed before timings could be trusted (`TypeError: fetch failed`, caused by `UND_ERR_INVALID_ARG: invalid onError method`). This means the implementation was incompatible with the runtime fetch stack, so no speed claim is valid for that experiment.
- **Rough context-estimation fast path attempt**: rejected and reverted. Three baseline runs of `large proxy in-process translation breakdown` for `claude-large-direct-buffered` averaged p50 4.514 ms, p95 6.391 ms, mean 4.824 ms. With the rough-estimate branch added, three runs averaged p50 4.712 ms, p95 7.262 ms, mean 5.058 ms. The targeted synthetic payload includes tools, so the guarded rough path did not remove the expensive exact estimator; it only added branching on this benchmark. Next attempt needs a dedicated no-tools/context-heavy benchmark before code changes.
- **Measured context-fit rough-estimation fast path**: accepted. After adding `claude-context-fit-no-tools-direct-buffered`, three baseline runs averaged p50 1.688 ms, p95 3.252 ms, mean 1.891 ms, JSON mean 1.441 ms, stringify mean 0.646 ms, and 4 stringify calls/run. With the guarded no-tools/string-content rough estimator, three final runs averaged p50 1.437 ms, p95 2.795 ms, mean 1.631 ms, JSON mean 1.187 ms, stringify mean 0.310 ms, and 3 stringify calls/run. The over-limit no-tools row stayed at 5 stringify calls/run, so exact trimming still runs when needed.
- **Claude high-volume SSE parser**: accepted. After adding `claude-high-volume-stream-parser` (1,000 mocked Together SSE events), three baseline runs averaged p50 2.899 ms, p95 3.843 ms, mean 2.969 ms, JSON mean 1.571 ms, and non-JSON mean 1.398 ms. Replacing regex/array-heavy event framing with a single newline scan averaged p50 2.402 ms, p95 3.350 ms, mean 2.512 ms, JSON mean 1.527 ms, and non-JSON mean 0.985 ms across three final runs. JSON parse/stringify call counts stayed unchanged, so the win is parser/framing overhead.
- **Parallel streamed native web_search execution**: accepted for Claude streaming. After adding `claude-stream-native-web-search-four-calls` (four mocked Exa calls, 4 ms delay each), three sequential baseline runs averaged p50 19.513 ms, p95 20.633 ms, mean 19.640 ms, and non-JSON mean 19.386 ms. Launching allowed Exa calls concurrently while preserving emitted tool-result order averaged p50 5.256 ms, p95 5.566 ms, mean 5.248 ms, and non-JSON mean 5.122 ms across three final runs. Exa and Together request counts stayed identical.
- **Session-level proxy perf aggregation**: accepted as a measurement feature. With `TOGETHERLINK_PERF=1`, proxied daemon sessions now collect per-request totals, span totals, and first-delta timing in memory and expose them on session views/cost responses. Verified by `daemon-state.test.ts` and by `TOGETHERLINK_PERF=1` captured-headless proxy benchmark output, which emitted 180 structured `[togetherlink perf]` request payloads while passing.
- **Cold daemon launch polling interval**: accepted. Five cold `ensureDaemon()` runs with isolated temp homes/ports averaged 212.901 ms (p50 210.157 ms) with the 200 ms health poll interval. Reducing the poll interval to 50 ms averaged 113.462 ms (p50 110.676 ms) across the same five-run shape, while each run reached health and shut down cleanly.
- **Per-commit benchmark series** (`635e552` baseline → `8206a9e` current, `pnpm bench:proxy`, mocked upstream):
  - Captured real-ish payloads: Codex was neutral/slightly noisy (p50 0.233 → 0.242 ms, p95 0.324 → 0.353 ms); Claude improved (p50 1.129 → 0.972 ms, p95 1.577 → 1.286 ms).
  - Claude streaming hygiene: local Claude streamed TTFT p95 improved in the captured TTFT benchmark after the socket flags landed (8.195 → 4.832 ms), while p50 was roughly similar/slightly higher (4.160 → 4.460 ms). Treat as a local p95 consistency win, not a live-network proof.
  - Async debug logging: normal non-debug timings were noisy; the value is removing synchronous filesystem stalls when `TOGETHERLINK_DEBUG_LOG` is enabled, not improving normal-path latency.
  - Common fast paths: mixed local timing result. Claude captured improved versus the previous commit, Codex captured was neutral, and large synthetic rows were noisy. Keep as a low-risk first pass, but require repeated A/B before adding more fast-path complexity.

**Experiment rule**: Every speed idea needs a named target, a baseline timing, one isolated change, the same timing repeated, and a success/failure classification before the next idea starts. If the benchmark does not exercise the change, add the benchmark first or reject the experiment.

**Philosophy**: Measure first (especially real sessions), optimize the common case (no images + no native tools), add cheap streaming hygiene, and only pursue bigger architectural changes (workers, alternate runtimes, HTTP/2) after telemetry shows local CPU is visible against upstream latency.

---

## Performance Roadmap

| Idea                                                                     | Expected win                                                            | Risk                                                        | How to measure                                                   | Status                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Add `TOGETHERLINK_PERF=1` phase timings in proxy handlers                | See real breakdown (parse, translate, vision, fetch, TTFT) vs synthetic | Very low                                                    | Instrumented runs + captured fixtures + live sessions            | Implemented                               |
| Improve benchmarks: TTFT + concurrent daemon load + real payloads        | Know whether local overhead is material next to network/vision          | Low                                                         | Extend `proxy-performance.bench.ts` + add live smoke             | Implemented                               |
| Add Claude `flushHeaders()` + `setNoDelay(true)` (match Codex)           | Lower and more consistent TTFT on streaming                             | Very low                                                    | Streaming TTFT microbench + real Claude Code sessions            | Implemented                               |
| Guard / remove sync debug logging (`appendFileSync`)                     | Eliminate potential FS stalls when debug is on                          | Very low                                                    | Microbench with/without debug + `TOGETHERLINK_DEBUG_LOG`         | Implemented; normal timings neutral/noisy |
| Fast-path common case (no images, no native tools, no special reasoning) | Reduce object churn and work on the 80-90% path                         | Low (if guarded)                                            | Existing benches + captured sessions + A/B on large context      | First pass; timing mixed                  |
| Keep-alive / connection reuse tuning for Together fetches                | Reduce per-request handshake latency                                    | Low code risk, **validation risk** (mocked benches hide it) | Live A/B with real Together API (not mocked benchmark)           | Failed local validation; reverted         |
| Cheaper context estimation + trim (rough length first)                   | Less stringify on every request                                         | Low                                                         | Dedicated no-tools/context-heavy bench + error-path coverage     | Implemented for simple no-tools payloads  |
| Improve streaming SSE parsers (less string work per chunk)               | Lower CPU during high-token-rate streams                                | Low                                                         | High-volume streaming bench + TTFT                               | Implemented for Claude high-volume stream |
| Parallel native tool (Exa) execution when model emits several            | Faster tool-turn latency when multiple searches                         | Low                                                         | Tool-heavy captured sessions                                     | Implemented for Claude streamed search    |
| Real session telemetry for proxy overhead / TTFT / vision cost           | Ground all future decisions in production data                          | Low (opt-in or debug-gated)                                 | Add to existing telemetry under perf flag or sampled             | Implemented opt-in session perf summary   |
| Parallelize vision failover (delayed race / after first is slow)         | Faster image description on cold images                                 | **High** (can double billable vision calls)                 | Vision latency + cost tracking in live runs                      | Skeptical — only with safeguards          |
| Worker threads for translation / Rust thin layer / HTTP/2 to Together    | Big wins on CPU-bound or connection paths                               | High (complexity, maintenance)                              | Only after real telemetry shows local CPU is visible vs upstream | **Premature** — revisit after measurement |
| Launch path slimming (daemon ensure, registration)                       | Lower time from `togetherlink claude` to first agent output             | Low                                                         | Instrument launcher timings                                      | Implemented cold daemon poll reduction    |

## Next 3 Steps

1. **Done**: Add `TOGETHERLINK_PERF=1` phase timings (body read, translate, vision, fetch, first delta, etc.) in the proxy handlers.
2. **Done**: Extend the benchmark with streaming TTFT measurement and concurrent captured-payload load.
3. **Done**: Implement Claude `flushHeaders()` + `setNoDelay(true)`. Next live A/B tests should use real Together traffic for keep-alive tuning and end-to-end TTFT.

These steps focus on measurement first and the highest-confidence, lowest-risk wins.

---

## Current Strengths

- Dedicated proxy performance benchmarks that already distinguish synthetic vs real captured payloads and instrument JSON time.
- Shared daemon: one process for all sessions (saves per-session startup and memory).
- Image description LRU cache prevents re-describing the same image repeatedly.
- Correctness-first design (retries, context trimming, native tool loops, accurate cost tracking including vision).
- Codex streaming already has some good socket hygiene.

---

## Identified Bottlenecks & Issues (with experimental context)

### JSON / Translation Work

The dominant _local_ cost for large payloads. Real captured sessions show this is already sub-millisecond for typical headless use. Still worth trimming on the common path.

Key sites:

- `readJsonBody` + full `toOpenAI*` / `toChat*` transforms
- Tool translation (especially Codex namespaces + custom)
- `applyEstimatedContextBudget` (stringify for size)
- Many small `JSON.stringify` in streaming writers and `writeSse`

### Image Handling (Claude)

Still a major potential source of added latency + cost because it introduces extra upstream calls. The LRU helps repeats, but first-time images and the per-request walk are unavoidable today.

### Network & External Calls

- No tuned keep-alive for Together (or Exa/vision).
- Retries cause full re-translation.
- Native web search adds extra roundtrips (serial today).
- Vision calls are the clearest "extra hop" users will feel.

**Important**: Current local benchmarks mock the upstream fetch, so they cannot measure keep-alive, TLS reuse, or real TTFT benefits.

### Streaming I/O & Daemon Loop

- Per-delta `res.write` + manual SSE parsing.
- Everything runs on a single event loop (JSON + vision + Exa all serialize).
- Claude is behind Codex on basic streaming socket flags.

### Launch & Observability

- Daemon ensure + registration happens before the agent binary runs.
- Almost no visibility today into where time is actually spent in a real session (the key gap).

---

## Refined Ideas (experiment-driven)

### Do these soon (high confidence, easy to validate)

1. **Phase timings under `TOGETHERLINK_PERF=1`** (or gated debug)
   - Record: body read, translation, vision, upstream fetch (with retry count), response map, time-to-first-delta, total handler time.
   - Make it easy to turn on for real Claude/Codex sessions.

2. **Claude streaming hygiene**
   - Add `res.flushHeaders()` and `res.socket?.setNoDelay(true)` in the Anthropic streaming path (matching what Codex already does).

3. **Eliminate sync side effects in debug**
   - Remove or async-ify the `appendFileSync` path when `TOGETHERLINK_DEBUG_LOG` is set.
   - Consider structured logging that only stringifies when a sink is active.

4. **Common-case fast path**
   - Early return / lighter code when there are no image blocks, no native server tools, and no special reasoning config.
   - This aligns with the "optimize the 80% path" instinct.

5. **Benchmark upgrades (required before big claims)**
   - Add TTFT measurement for streaming responses.
   - Add concurrent load (multiple sessions against one daemon).
   - Keep the synthetic vs captured distinction.
   - Consider a "live against real Together" mode (with cost accounting) for validation.

### Approach carefully or later

- **Vision failover**: Only consider parallel after first model is observably slow (delayed race), or make it explicitly opt-in. Parallel calls risk doubling vision spend if both are billed.
- **Keep-alive tuning**: Cheap to implement, but must be validated with _live_ traffic against real Together (mocked benches give false confidence).
- **Worker threads, alternate runtime, HTTP/2**: Treat as "investigate only after real telemetry shows local CPU time is a first-order contributor compared with network + model latency."

### Other worthwhile work

- Cheaper context estimation (length heuristic before stringify).
- Concurrent Exa calls when multiple native searches are requested in one turn.
- Tighter streaming SSE parsing (less per-chunk string work).
- Instrument real sessions (sampled or under perf flag) so we stop guessing.

---

## Measurement & Diagnostics (the real priority)

Before any architectural change, we need to know:

1. In actual user sessions, what fraction of end-to-end time is spent inside the proxy vs waiting on Together / vision / Exa?
2. What is real TTFT (first visible token to the user) with and without the proposed cheap changes?
3. How does the daemon behave under 2–4 concurrent agent sessions?
4. How often do images and native tools actually appear in real traffic?

Planned instrumentation:

- `TOGETHERLINK_PERF=1` mode that logs phase timings + token counts per request.
- Extend the benchmark to report TTFT and support concurrent execution.
- Add lightweight per-turn proxy overhead to session telemetry (debug-gated or sampled).
- Vision cost is tracked in cost accounting (CostTracker), but not surfaced clearly to users today.

Only after the above data exists should we seriously evaluate worker threads, Rust shims, or protocol upgrades.

---

## Other Notes

- Local proxy overhead on real payloads is already excellent. The value of togetherlink is the compatibility layer; we should not trade correctness or debuggability for marginal micro-optimizations.
- Self-reporting paths (OpenCode today, potentially others) will always have a speed advantage because they skip translation.
- Keep the existing benchmark discipline: synthetic for worst-case local cost, captured fixtures for realism, and live runs for the truth.

**Status**: This is a living roadmap. Update the table and notes with new measurements, accepted/rejected proposals, and profiling results.

**Last updated**: 2026-06-30
