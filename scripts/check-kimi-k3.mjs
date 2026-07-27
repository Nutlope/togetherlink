#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { KIMI_K3 } from "../packages/models/dist/index.js";

const MODEL_ID = KIMI_K3.id;
const DOCS_URL = "https://www.together.ai/models/kimi-k3";
const API_BASE_URL = "https://api.together.xyz/v1";
const PUBLISHED_CONTEXT_LENGTH = 1_000_000;
// K3 always spends part of the completion budget on reasoning. Tiny smoke-test
// budgets can therefore finish before any assistant content is emitted.
const SMOKE_MAX_TOKENS = 1_024;

const apiKey = process.env.TOGETHER_API_KEY || (await apiKeyFromEnvFile());
if (!apiKey) {
  fail("TOGETHER_API_KEY is not set and was not found in .env.");
}

const docs = await checkDocs();
const catalog = await checkCatalog(apiKey);
const [chat, stream, tools, jsonMode, outputCeiling, ...reasoning] = await Promise.all([
  checkChat(apiKey),
  checkStreaming(apiKey),
  checkTools(apiKey),
  checkJsonMode(apiKey),
  checkOutputCeiling(apiKey),
  ...(KIMI_K3.reasoningEfforts ?? []).map((effort) => checkReasoning(apiKey, effort)),
]);

const exactModel = catalog.matches.find((model) => model.id === MODEL_ID);
const catalogMetadataReady = Boolean(
  exactModel &&
  exactModel.context_length === PUBLISHED_CONTEXT_LENGTH &&
  exactModel.pricing?.input === KIMI_K3.cost.input &&
  exactModel.pricing?.cached_input === KIMI_K3.cost.cache_read &&
  exactModel.pricing?.output === KIMI_K3.cost.output,
);
const releaseReady = Boolean(
  docs.ok &&
  catalogMetadataReady &&
  chat.ok &&
  stream.ok &&
  tools.ok &&
  jsonMode.ok &&
  outputCeiling.ok &&
  reasoning.length === KIMI_K3.reasoningEfforts?.length &&
  reasoning.every((result) => result.ok),
);

console.log(`Kimi K3 support check (${new Date().toISOString()})`);
console.log(`docs: ${docs.summary}`);
console.log(
  `catalog: HTTP ${catalog.status}; ${exactModel ? `found ${MODEL_ID}` : `${MODEL_ID} missing`}`,
);
for (const model of catalog.matches) {
  console.log(`catalog match: ${JSON.stringify(model)}`);
}
console.log(`chat: ${chat.summary}`);
console.log(`stream: ${stream.summary}`);
console.log(`tools: ${tools.summary}`);
console.log(`JSON mode: ${jsonMode.summary}`);
console.log(`output ceiling: ${outputCeiling.summary}`);
for (const result of reasoning) {
  console.log(`reasoning ${result.effort}: ${result.summary}`);
}
console.log(
  `registry: context=${KIMI_K3.limit.context}; output=${KIMI_K3.limit.output}; efforts=${KIMI_K3.reasoningEfforts?.join(",")}`,
);
console.log(`support check: ${releaseReady ? "PASS" : "BLOCKED"}`);

if (exactModel && exactModel.context_length !== PUBLISHED_CONTEXT_LENGTH) {
  console.log(
    `warning: live catalog context ${exactModel.context_length} differs from the published 1M context`,
  );
}
if (
  exactModel &&
  (!exactModel.pricing || exactModel.pricing.input <= 0 || exactModel.pricing.output <= 0)
) {
  console.log("warning: live catalog does not expose positive input/output pricing");
}

process.exitCode = releaseReady ? 0 : 1;

async function apiKeyFromEnvFile() {
  const text = await readFile(new URL("../.env", import.meta.url), "utf8").catch(() => "");
  const line = text.split(/\r?\n/).find((entry) => /^TOGETHER_API_KEY\s*=/.test(entry));
  if (!line) {
    return undefined;
  }
  return unquote(line.replace(/^TOGETHER_API_KEY\s*=\s*/, "").trim());
}

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function checkDocs() {
  try {
    const response = await fetch(DOCS_URL, {
      headers: { "User-Agent": "togetherlink-kimi-k3-release-check" },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    const comingSoon = /coming soon to Together(?:’|')s Serverless API/i.test(text);
    const advertised = {
      chat: />Chat</i.test(text),
      reasoning: />Reasoning</i.test(text),
      vision: />Vision</i.test(text),
      jsonMode: /JSON Mode/i.test(text),
      functionCalling: /Function Calling/i.test(text),
      oneMillionContext: /(?:>1M<|1M context)/i.test(text),
    };
    return {
      ok: response.ok && !comingSoon && Object.values(advertised).every(Boolean),
      comingSoon,
      advertised,
      summary: `HTTP ${response.status}; ${comingSoon ? "coming soon" : "no coming-soon marker"}; ${formatCapabilities(advertised)}`,
    };
  } catch (error) {
    return {
      ok: false,
      comingSoon: false,
      advertised: {},
      summary: `request failed: ${errorMessage(error)}`,
    };
  }
}

async function checkCatalog(key) {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json();
    const models = Array.isArray(body) ? body : body?.data || [];
    const matches = models
      .filter((model) =>
        /kimi.?k3|moonshotai\/kimi-k3/i.test(
          `${model?.id || ""} ${model?.display_name || ""} ${model?.name || ""}`,
        ),
      )
      .map((model) => ({
        id: model.id,
        display_name: model.display_name,
        type: model.type,
        context_length: model.context_length,
        pricing: model.pricing,
      }));
    return { status: response.status, matches };
  } catch (error) {
    return { status: "request failed", matches: [], error: errorMessage(error) };
  }
}

async function checkChat(key) {
  const result = await postChat(key, {
    messages: [{ role: "user", content: "Reply exactly OK" }],
    max_tokens: SMOKE_MAX_TOKENS,
    reasoning_effort: "low",
    temperature: 0,
  });
  if (!result.response.ok) {
    return failedApiCheck(result);
  }
  const content = result.body?.choices?.[0]?.message?.content;
  return {
    ok: typeof content === "string" && content.trim().length > 0,
    summary: `HTTP ${result.response.status}; ${content ? `output ${JSON.stringify(content.trim())}` : "no assistant output"}`,
  };
}

async function checkStreaming(key) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content: "Reply exactly STREAM_OK" }],
        max_tokens: SMOKE_MAX_TOKENS,
        reasoning_effort: "low",
        temperature: 0,
        stream: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        summary: `HTTP ${response.status}; ${apiErrorFromText(text)}`,
      };
    }
    const events = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    const done = events.includes("[DONE]");
    const output = events
      .filter((event) => event !== "[DONE]")
      .flatMap((event) => {
        try {
          return [JSON.parse(event)?.choices?.[0]?.delta?.content || ""];
        } catch {
          return [];
        }
      })
      .join("");
    return {
      ok: done && output.trim().length > 0,
      summary: `HTTP ${response.status}; done=${done}; ${output ? `output ${JSON.stringify(output.trim())}` : "no assistant output"}`,
    };
  } catch (error) {
    return { ok: false, summary: `request failed: ${errorMessage(error)}` };
  }
}

async function checkTools(key) {
  const result = await postChat(key, {
    messages: [
      {
        role: "user",
        content: "Call release_probe with ready=true. Do not answer in prose.",
      },
    ],
    max_tokens: SMOKE_MAX_TOKENS,
    reasoning_effort: "low",
    tools: [
      {
        type: "function",
        function: {
          name: "release_probe",
          description: "Confirms that Kimi K3 emitted a valid function call.",
          parameters: {
            type: "object",
            properties: { ready: { type: "boolean" } },
            required: ["ready"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "release_probe" } },
  });
  if (!result.response.ok) {
    return failedApiCheck(result);
  }
  const call = result.body?.choices?.[0]?.message?.tool_calls?.[0];
  let args;
  try {
    args = JSON.parse(call?.function?.arguments || "{}");
  } catch {
    args = undefined;
  }
  const ok = call?.function?.name === "release_probe" && args?.ready === true;
  return {
    ok,
    summary: `HTTP ${result.response.status}; ${ok ? "valid release_probe call" : "missing or invalid release_probe call"}`,
  };
}

async function checkJsonMode(key) {
  const result = await postChat(key, {
    messages: [{ role: "user", content: 'Return only this JSON object: {"ready":true}' }],
    max_tokens: SMOKE_MAX_TOKENS,
    reasoning_effort: "low",
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.response.ok) {
    return failedApiCheck(result);
  }
  const content = result.body?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = JSON.parse(content || "");
  } catch {
    parsed = undefined;
  }
  const ok = parsed?.ready === true;
  return {
    ok,
    summary: `HTTP ${result.response.status}; ${ok ? "valid JSON object" : "missing or invalid JSON object"}`,
  };
}

async function checkOutputCeiling(key) {
  const result = await postChat(key, {
    messages: [{ role: "user", content: "Reply exactly OUTPUT_LIMIT_OK" }],
    max_tokens: KIMI_K3.limit.output,
    reasoning_effort: "low",
    temperature: 0,
  });
  if (!result.response.ok) {
    return failedApiCheck(result);
  }
  const content = result.body?.choices?.[0]?.message?.content;
  return {
    ok: content?.trim() === "OUTPUT_LIMIT_OK",
    summary: `HTTP ${result.response.status}; requested max_tokens=${KIMI_K3.limit.output}; ${content ? `output ${JSON.stringify(content.trim())}` : "no assistant output"}`,
  };
}

async function checkReasoning(key, effort) {
  const result = await postChat(key, {
    messages: [{ role: "user", content: `Reply exactly ${effort.toUpperCase()}_REASONING_OK` }],
    max_tokens: SMOKE_MAX_TOKENS,
    reasoning_effort: effort,
  });
  if (!result.response.ok) {
    return { effort, ...failedApiCheck(result) };
  }
  const choice = result.body?.choices?.[0];
  const content = choice?.message?.content;
  const reasoningContent = choice?.message?.reasoning_content;
  return {
    effort,
    ok:
      typeof content === "string" &&
      content.trim().length > 0 &&
      typeof reasoningContent === "string" &&
      reasoningContent.trim().length > 0,
    summary: `HTTP ${result.response.status}; assistant output=${Boolean(content)}; reasoning_content=${Boolean(reasoningContent)}`,
  };
}

async function postChat(key, body) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL_ID, ...body }),
      signal: AbortSignal.timeout(30_000),
    });
    const responseBody = await response.json().catch(() => ({}));
    return { response, body: responseBody };
  } catch (error) {
    return {
      response: { ok: false, status: "request failed" },
      body: { error: { message: errorMessage(error) } },
    };
  }
}

function failedApiCheck(result) {
  return {
    ok: false,
    summary: `HTTP ${result.response.status}; ${apiError(result.body)}`,
  };
}

function apiError(body) {
  return body?.error?.code || body?.error?.message || body?.message || "unknown API error";
}

function apiErrorFromText(text) {
  try {
    return apiError(JSON.parse(text));
  } catch {
    return text.trim().slice(0, 200) || "empty error response";
  }
}

function formatCapabilities(capabilities) {
  const present = Object.entries(capabilities)
    .filter(([, value]) => value)
    .map(([key]) => key);
  return present.length > 0 ? present.join(", ") : "capabilities not parsed";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
