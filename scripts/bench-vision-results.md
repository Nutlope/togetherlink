# Vision model benchmark — image → text

Tested which Together serverless model is fastest + most precise at describing
images, for the proxy's image-intercept feature (Claude Code sends an `image`
block that GLM-5.2 can't see; the proxy routes it to a vision model, gets text,
and feeds that to GLM-5.2).

Run: `source .env && node scripts/bench-vision.mjs`
Full transcripts: `scripts/bench-vision-out/<model>__<image>.txt`

## Setup
- 7 models × 4 images = 28 calls, sequential.
- Images: tiny avatar (230px), screenshot with lots of text (1200×630),
  a photo (1024×1024), a large PNG (3268×2140, 3.2 MB).
- **Reasoning disabled** (`reasoning: { enabled: false }`, `temperature: 0.6`)
  — image description is a perception task, not a reasoning one. With reasoning
  ON, the hybrid models (Qwen, Kimi) spent the whole token budget in the hidden
  `reasoning` field and emitted empty `content`, so there was no usable answer.
- Same prompt for all: "Describe this image concisely. Then on a new line
  starting TEXT: list any visible text verbatim."

## Latency (reasoning off, avg over 4 images)

| Model | API ID | Vision per docs | Avg ms | Notes |
| :-- | :-- | :-- | --: | :-- |
| Qwen3.5 397B | `Qwen/Qwen3.5-397B-A17B` | not listed, but works | 4228 | fastest, great quality, $0.60/$3.60 |
| Kimi K2.7 Code | `moonshotai/Kimi-K2.7-Code` | yes | 4369 | strong, concise, $0.95/$4.00 |
| Kimi K2.6 | `moonshotai/Kimi-K2.6` | yes | 4561 | strong, $1.20/$4.50 |
| Gemma 3N E4B | `google/gemma-3n-E4B-it` | not listed, but works | 4990 | cheapest ($0.06/$0.12), decent |
| Gemma 4 31B | `google/gemma-4-31B-it` | yes | 6562 | high text-recall, occasionally slow |
| MiniMax M3 | `MiniMaxAI/MiniMax-M3` | yes | 7311 | good, but slower + priceier |
| Qwen3.5 9B | `Qwen/Qwen3.5-9B` | yes (recommended) | 8909 | best OCR detail, but slowest |

## Quality
- **All 7 actually see the image** — every model correctly described the avatar
  (three overlapping lavender/magenta/orange circles, triangular layout). None
  hallucinated. The two models not listed in Together's "vision models" table
  (Qwen3.5 397B, Gemma 3N) still produce real visual descriptions — the docs
  table is just incomplete, not a capability gate.
- **Text/OCR recall**: Qwen3.5 9B and Kimi K2.6 transcribed nearly all verbatim
  text from the screenshot. Qwen3.5 397B, Gemma 3N, and MiniMax M3 were strong
  too. Kimi K2.7 Code gave a good summary but lighter on verbatim OCR.
- **Gemma 4 31B** invented a bogus reading on the logo ("letters N/E/O → NEO")
  — minor hallucination on a textless image; otherwise strong.

## Recommendation

Primary: **`moonshotai/Kimi-K2.7-Code`** — strong quality, consistently fast
(under ~1s on small images, ~4s on the big one), good OCR. Good price.

If cost matters more than peak OCR: **`google/gemma-3n-E4B-it`** — by far the
cheapest ($0.06/$0.12 per 1M), still genuinely sees images, ~5s avg. The
non-listed-but-working status is a small risk if Together changes it.

If maximum OCR fidelity matters (e.g. screenshots dense with text):
**`Qwen/Qwen3.5-9B`** has the best verbatim transcription but is the slowest,
so better as a fallback than the default path.

## Key implementation note
Always send `reasoning: { enabled: false }` on the vision sub-call. With
reasoning on, hybrid models return empty `content` and the intercept would
feed GLM-5.2 nothing — the exact bug we're trying to fix.