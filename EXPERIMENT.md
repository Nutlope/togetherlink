# Claude historical-thinking replay experiment

Status: candidate frozen; one full E2B feasibility run pending

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

## Important boundary

This change reduces the history sent from TogetherLink to Together. It does not remove thinking blocks already shown to and stored by Claude Code, so it is not expected by itself to prevent Claude Code's local auto-compaction. The full run must separately measure provider cost/output behavior and client compaction.

## Next gate

Run exactly one network-sealed TogetherLink TinyDB invocation using this frozen bundle. It is a feasibility run, not a stability claim. If it completes normally with READY and all 204 evaluator outcomes while preserving score, compare its duration, cost, output tokens, turns, and compaction with the frozen five-run baseline before deciding whether it merits a three-run screen.
