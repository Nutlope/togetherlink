#!/usr/bin/env node
// Benchmark: which Together serverless model is fastest + most precise at image→text.
// Run with TOGETHER_API_KEY in env. Sequential calls for clean per-model latency.
//
//   node scripts/bench-vision.mjs
//
// Full per-image transcripts are written to scripts/bench-vision-out/<model>__<image>.txt

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const API = "https://api.together.ai/v1/chat/completions";
const KEY = process.env.TOGETHER_API_KEY?.trim();
if (!KEY) {
  console.error("TOGETHER_API_KEY is not set. Source the repo .env first.");
  process.exit(1);
}

const MODELS = [
  { id: "Qwen/Qwen3.5-9B", label: "Qwen3.5 9B" },
  { id: "google/gemma-4-31B-it", label: "Gemma 4 31B" },
  { id: "MiniMaxAI/MiniMax-M3", label: "MiniMax M3" },
  { id: "moonshotai/Kimi-K2.7-Code", label: "Kimi K2.7 Code" },
  { id: "moonshotai/Kimi-K2.6", label: "Kimi K2.6" },
  { id: "Qwen/Qwen3.5-397B-A17B", label: "Qwen3.5 397B (no vision?)" },
  { id: "google/gemma-3n-E4B-it", label: "Gemma 3N E4B (no vision?)" },
];

const IMG_DIR = path.join(process.cwd(), "images-test");
const IMAGES = [
  { file: "together-avatar.jpg", label: "avatar(jpg,230px)" },
  { file: "screen01.png", label: "screen01(png,1200x630)" },
  { file: "kid-photo.png", label: "kid-photo(png,1024x1024)" },
  { file: "acpe.png", label: "acpe(png,3268x2140,3.2MB)" },
];

const OUT_DIR = path.join(process.cwd(), "scripts", "bench-vision-out");
mkdirSync(OUT_DIR, { recursive: true });

// Same prompt for every model/image so quality is comparable. Asks for detail
// + verbatim OCR text, which is what a Claude Code image-intercept needs.
const PROMPT =
  "Describe this image concisely. Then on a new line starting 'TEXT:' list any visible text verbatim. Keep it under 120 words.";

function dataUrl(file) {
  const buf = readFileSync(path.join(IMG_DIR, file));
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function call(model, url) {
  const start = performance.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
      max_tokens: 1500,
      // Image description is a perception task, not a reasoning one. Disabling
      // reasoning avoids the empty-`content` trap (reasoning models spend the
      // whole budget in the hidden `reasoning` field) and is faster/cheaper.
      reasoning: { enabled: false },
      // Instant-mode temperature per Together's Kimi K2.6 docs.
      temperature: 0.6,
      top_p: 0.95,
      stream: false,
    }),
  });
  const elapsedMs = Math.round(performance.now() - start);
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, elapsedMs, status: res.status, error: raw.slice(0, 200) };
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, elapsedMs, status: res.status, error: "non-JSON" };
  }
  const content = json.choices?.[0]?.message?.content ?? "";
  const reasoning = json.choices?.[0]?.message?.reasoning ?? "";
  const usage = json.usage ?? {};
  // Reasoning models (Qwen, Kimi) may spend the whole budget in `reasoning`
  // and emit empty `content`. Use reasoning as a fallback so we can still see
  // whether the model actually processed the image vs hallucinated from text.
  const answer = content || reasoning;
  return {
    ok: true,
    elapsedMs,
    content: answer,
    hasVisibleContent: Boolean(content),
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    reasoningTokens: usage.reasoning_tokens ?? 0,
  };
}

const results = [];
console.log(`Benchmarking ${MODELS.length} models × ${IMAGES.length} images = ${MODELS.length * IMAGES.length} calls\n`);

for (const img of IMAGES) {
  const url = dataUrl(img.file);
  console.log(`\n=== ${img.label} ===`);
  for (const m of MODELS) {
    process.stdout.write(`  ${m.label.padEnd(28)} ... `);
    let r;
    try {
      r = await call(m.id, url);
    } catch (err) {
      r = { ok: false, elapsedMs: -1, status: "throw", error: String(err).slice(0, 160) };
    }
    if (r.ok) {
      console.log(
        `${String(r.elapsedMs).padStart(6)}ms  in=${String(r.promptTokens).padStart(5)} out=${String(r.completionTokens).padStart(4)}`,
      );
      writeFileSync(
        path.join(OUT_DIR, `${m.id.replaceAll("/", "_")}__${img.file}.txt`),
        `${m.label} | ${img.label} | ${r.elapsedMs}ms | in=${r.promptTokens} out=${r.completionTokens}\n\n${r.content}\n`,
      );
    } else {
      console.log(`FAIL ${r.elapsedMs}ms status=${r.status} ${r.error}`);
    }
    results.push({ model: m.label, image: img.label, ...r });
  }
}

// Summary table: avg latency + success per model.
console.log("\n\n================ SUMMARY (avg latency across successful image calls) ================");
const byModel = new Map();
for (const r of results) {
  if (!byModel.has(r.model)) byModel.set(r.model, []);
  byModel.get(r.model).push(r);
}
const rows = [...byModel.entries()].map(([label, rs]) => {
  const ok = rs.filter((r) => r.ok);
  const avg = ok.length ? Math.round(ok.reduce((s, r) => s + r.elapsedMs, 0) / ok.length) : 0;
  return { label, ok: ok.length, total: rs.length, avgMs: avg };
});
rows.sort((a, b) => (b.ok - a.ok) || a.avgMs - b.avgMs);
console.log("Model                         ok/total   avg ms");
for (const r of rows) {
  console.log(
    `${r.label.padEnd(29)}    ${r.ok}/${r.total}     ${r.ok ? r.avgMs : "—"}`,
  );
}
console.log(`\nFull transcripts in ${OUT_DIR}`);