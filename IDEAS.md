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

**Philosophy**: Measure first (especially real sessions), optimize the common case (no images + no native tools), add cheap streaming hygiene, and only pursue bigger architectural changes (workers, alternate runtimes, HTTP/2) after telemetry shows local CPU is visible against upstream latency.

---

## Performance Roadmap

| Idea                                                                     | Expected win                                                            | Risk                                                        | How to measure                                                   | Status                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Add `TOGETHERLINK_PERF=1` phase timings in proxy handlers                | See real breakdown (parse, translate, vision, fetch, TTFT) vs synthetic | Very low                                                    | Instrumented runs + captured fixtures + live sessions            | Implemented                               |
| Improve benchmarks: TTFT + concurrent daemon load + real payloads        | Know whether local overhead is material next to network/vision          | Low                                                         | Extend `proxy-performance.bench.ts` + add live smoke             | Implemented                               |
| Add Claude `flushHeaders()` + `setNoDelay(true)` (match Codex)           | Lower and more consistent TTFT on streaming                             | Very low                                                    | Streaming TTFT microbench + real Claude Code sessions            | Implemented                               |
| Guard / remove sync debug logging (`appendFileSync`)                     | Eliminate potential FS stalls when debug is on                          | Very low                                                    | Microbench with/without debug + `TOGETHERLINK_DEBUG_LOG`         | Implemented                               |
| Fast-path common case (no images, no native tools, no special reasoning) | Reduce object churn and work on the 80-90% path                         | Low (if guarded)                                            | Existing benches + captured sessions + A/B on large context      | Implemented (first pass)                  |
| Keep-alive / connection reuse tuning for Together fetches                | Reduce per-request handshake latency                                    | Low code risk, **validation risk** (mocked benches hide it) | Live A/B with real Together API (not mocked benchmark)           | Plausible, needs real measurement         |
| Cheaper context estimation + trim (rough length first)                   | Less stringify on every request                                         | Low                                                         | Benches + error-path coverage                                    | Worth doing                               |
| Improve streaming SSE parsers (less string work per chunk)               | Lower CPU during high-token-rate streams                                | Low                                                         | High-volume streaming bench + TTFT                               | Medium                                    |
| Parallel native tool (Exa) execution when model emits several            | Faster tool-turn latency when multiple searches                         | Low                                                         | Tool-heavy captured sessions                                     | Medium                                    |
| Real session telemetry for proxy overhead / TTFT / vision cost           | Ground all future decisions in production data                          | Low (opt-in or debug-gated)                                 | Add to existing telemetry under perf flag or sampled             | **Critical next measurement**             |
| Parallelize vision failover (delayed race / after first is slow)         | Faster image description on cold images                                 | **High** (can double billable vision calls)                 | Vision latency + cost tracking in live runs                      | Skeptical — only with safeguards          |
| Worker threads for translation / Rust thin layer / HTTP/2 to Together    | Big wins on CPU-bound or connection paths                               | High (complexity, maintenance)                              | Only after real telemetry shows local CPU is visible vs upstream | **Premature** — revisit after measurement |
| Launch path slimming (daemon ensure, registration)                       | Lower time from `togetherlink claude` to first agent output             | Low                                                         | Instrument launcher timings                                      | Nice-to-have                              |

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
