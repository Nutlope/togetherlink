# Claude historical-thinking replay experiment

Status: three-run screen passed the review gate on correctness, duration, compaction, and protocol validity; provider cost regressed and requires separate optimization

## Hypothesis

TogetherLink translates every prior Claude `thinking` block back into Together's `reasoning_content`. On long tool loops this hidden history grows on every request and may increase provider input, encourage repeated reasoning, and contribute to TogetherLink's higher duration and cost relative to FireConnect.

The candidate removes only historical `thinking` and `redacted_thinking` blocks while preserving assistant text, tool calls, tool results, and newly generated reasoning returned to Claude Code.

## Frozen inputs

- TogetherLink baseline: `2d0ffb67bc3dd22baca0680ae038e1e36e9ea071` (v0.8.3)
- Branch: `codex/claude-drop-history-thinking-v1`
- Claude Code: `2.1.235`
- Model: GLM-5.2
- Candidate bundle: `site/public/togetherlink.js`
- Bundle SHA-256: `826e8ffad2925c06796818247b89f2c6fca573b9bbd6fd6f1df0dea3ba91a17e`

## No-cost replay gate

The analysis script reconstructs the real conversation history preceding the first compaction in each valid TogetherLink Claude baseline run. It sends the same reconstructed history through the v0.8.3 and candidate translators without provider inference.

| Run | Claude pre-compaction tokens | Historical thinking chars | Baseline payload | Candidate payload | Reduction |
| --: | ---------------------------: | ------------------------: | ---------------: | ----------------: | --------: |
|   1 |                      172,787 |                   451,274 |        779,461 B |         316,758 B |     59.4% |
|   2 |                      167,841 |                   380,599 |        749,724 B |         359,258 B |     52.1% |
|   3 |                      167,605 |                   398,288 |        806,100 B |         397,102 B |     50.7% |
|   4 |                      168,752 |                   285,791 |        747,946 B |         455,368 B |     39.1% |
|   5 |                      167,228 |                   360,994 |        737,217 B |         367,162 B |     50.2% |

Median payload falls from 749,724 bytes to 367,162 bytes. Across the five snapshots, the candidate removes 1,924,800 of 3,820,448 bytes (50.4%) and all 270 historical `reasoning_content` messages.

Representative source artifact SHA-256: `7e7336abcd946695ccacdd98d5b55633bdfdf301f8aec02c8e963cc99589cee7`.

## Compatibility gate

- Focused regression: passed
- Claude proxy suite: 51 passed
- Deterministic core gauntlet: 201 passed, 43 opt-in live tests skipped
- Typecheck: passed
- Format check: passed
- Live GLM-5.2 Claude Read-tool loop: completed normally in two turns with the correct repository summary; TogetherLink meter recorded $0.0330

One earlier live attempt used a stale key and returned HTTP 402 before inference. A second valid-key attempt completed two turns but Claude Code's conservative cost estimate crossed a deliberately low $0.15 test cap; TogetherLink measured $0.0485. Neither is candidate validity evidence.

## First full E2B feasibility run

Run `togetherlink-claude-tinydb-2026-08-20T14-37-20.195Z-e6450987` used the frozen candidate bundle in one complete Claude Code invocation. It ran in a fresh E2B sandbox with model-only egress to Together, a sealed evaluator, the unchanged TinyDB task hash, GLM-5.2, Claude Code 2.1.235, and the matched 200k context profile.

The comparison below uses the median of the five valid frozen TogetherLink baseline runs. This is a one-run feasibility result, not a stability estimate.

| Measure                       | Frozen baseline median |  Candidate run |  Change |
| ----------------------------- | ---------------------: | -------------: | ------: |
| Evaluator pass count          |                172/204 |        173/204 | +1 test |
| Agent duration                |                40m 51s |        16m 30s |  -59.6% |
| Provider cost                 |                $5.7119 |        $4.7582 |  -16.7% |
| Output tokens                 |                260,883 |        101,214 |  -61.2% |
| Claude turns                  |                    156 |            212 |  +35.9% |
| Compactions                   |                      1 |              0 |      -1 |
| Maximum provider input        |         164,883 tokens | 111,526 tokens |  -32.4% |
| Provider requests             |                    145 |            201 |  +38.6% |
| Responses containing thinking |                     89 |              6 |  -93.3% |
| Streamed thinking             |          537,248 chars |   45,227 chars |  -91.6% |

The invocation exited 0 with terminal reason `completed`, produced READY, and returned all 204 evaluator outcomes: 173 passed, 30 failed, 0 errored, and 1 skipped. The transport log contains 201 completed streams and 201 metered requests with no logged error, timeout, retry, or reconnect.

One internal provider response stopped at `max_tokens` after emitting 28,000 output tokens and hitting TogetherLink's 32,000-character thinking cap. Claude Code issued its next normal model request inside the same invocation, and the run later ended normally. This was not a continuation, resume, or second agent run. The five baseline runs had one or two such internal `max_tokens` responses each.

### What the result supports

The model did not do less agent work: it used 212 turns and 211 tool calls, both above the baseline median. The measured improvement instead lines up with the hypothesis that replayed hidden reasoning was amplifying later requests. After removing that replay, the model generated reasoning on only six requests, maximum provider input stayed at 111,526 tokens, Claude Code did not compact, and correctness remained at the baseline level.

The candidate does not delete thinking blocks already stored in Claude Code's local transcript. However, this run shows that reducing the history sent to the provider can also keep Claude Code's observed request usage below its compaction threshold.

### Directional FireConnect comparison

The historical five-run FireConnect median was 163/204, 20m 33s, $1.1982, 89,336 output tokens, 73 turns, and zero compactions. The three-run candidate median scored six tests higher and took 24 seconds longer, but remained 6.1x more expensive, used 50% more output tokens, and used 3.2x as many turns. Because this candidate screen is compared with a historical distribution rather than fresh matched pairs, it is directional evidence only.

## Three-run screen

The two independent replications used the same frozen bundle, task hash, Claude Code version, GLM-5.2 model, matched 200k context, E2B isolation, and network policy. No run was resumed, continued after termination, or combined with another invocation.

|                    Run |       Score |    Duration |        Cost | Output tokens |   Turns | Compactions | Thinking responses |
| ---------------------: | ----------: | ----------: | ----------: | ------------: | ------: | ----------: | -----------------: |
|                      1 |     173/204 |     16m 30s |     $4.7582 |       101,214 |     212 |           0 |                  6 |
|                      2 |     169/204 |     20m 57s |     $7.3147 |       134,379 |     237 |           0 |                  6 |
|                      3 |     164/204 |     41m 03s |     $9.0242 |       286,328 |     334 |           1 |                 19 |
|   **Candidate median** | **169/204** | **20m 57s** | **$7.3147** |   **134,379** | **237** |       **0** |              **6** |
| Frozen Together median |     172/204 |     40m 51s |     $5.7119 |       260,883 |     156 |           1 |                 89 |

All three runs exited 0 with terminal reason `completed`, produced READY, and returned all 204 evaluator outcomes. All three used fresh isolated sandboxes, passed the secret scan, and logged no transport error, timeout, retry, or reconnect.

Relative to the frozen Together median, the candidate median:

- lost 3 evaluator passes while remaining above the predeclared 167-pass floor;
- reduced duration by 48.7%;
- reduced output tokens by 48.5%;
- reduced thinking-bearing responses by 93.3%;
- reduced median compactions from 1 to 0, although the longest run still compacted once at 167,377 pre-compaction tokens;
- increased turns by 51.9%; and
- increased provider cost by 28.1%.

The result confirms the narrow mechanism: historical reasoning replay was a major source of output and duration amplification. It does not establish that the change eliminates compaction or reduces cost on every trajectory. The remaining efficiency gap is dominated by more agent turns and provider requests, including large volumes of cached input.

## Decision and next gate

The candidate passes its predeclared three-run promotion gate:

- 3/3 normal READY runs with all 204 outcomes;
- median score 169, above the 167 floor;
- median compactions 0;
- median duration improved by more than 20%; and
- no protocol or isolation regression.

Promote the branch for code review, not automatic merge. The review should decide whether omitting historical `thinking` is an acceptable Claude-compatibility policy. Do not spend more full TinyDB runs on this unchanged candidate. The next controlled experiment should target the remaining request/turn proliferation; a fresh matched FireConnect run is only needed if making a causal provider-comparison claim rather than evaluating this TogetherLink change against its frozen baseline.
