import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "../packages/models/dist/index.js";

const docsPath = new URL("../site/public/llms.txt", import.meta.url);
const docs = readFileSync(docsPath, "utf8");
const start = docs.indexOf("## Available Models\n");
const end = docs.indexOf("## Headless & agentic usage\n");

if (start < 0 || end <= start) {
  throw new Error("Could not find the Available Models section in site/public/llms.txt");
}

const alternate =
  SELECTABLE_MODELS.find(
    (model) => model.id !== DEFAULT_MODEL.id && model.limit.context >= 1_000_000,
  ) ?? SELECTABLE_MODELS.find((model) => model.id !== DEFAULT_MODEL.id);

const price = (value) => `$${value.toFixed(3).replace(/\.?0+$/, "")}`;
const context = (tokens) =>
  tokens >= 1_000_000 ? "1M context" : `${Math.round(tokens / 1_000)}K context`;
const tableRows = SELECTABLE_MODELS.map(
  (model) =>
    `| ${model.name}${model.id === DEFAULT_MODEL.id ? " (default)" : ""} | \`${model.id}\` | ${price(model.cost.input)} | ${price(model.cost.output)} | ${price(model.cost.cache_read)} |`,
).join("\n");
const capabilities = SELECTABLE_MODELS.map((model) => {
  const traits = [
    model.attachment ? "Vision" : "Text-only",
    context(model.limit.context),
    model.reasoning ? "reasoning" : undefined,
    model.tool_call ? "function calling" : undefined,
  ].filter(Boolean);
  return `- \`${model.id}\` — ${model.name}${model.id === DEFAULT_MODEL.id ? " · default" : ""}. ${traits.join(", ")}.`;
}).join("\n");
const textOnlyNames = SELECTABLE_MODELS.filter((model) => !model.attachment)
  .map((model) => model.name)
  .join(", ");

const section = `## Available Models

togetherlink routes to a curated set of Together AI models. The default for every coding harness is ${DEFAULT_MODEL.name}.

Serverless prices below are in USD per 1 million tokens and come from Together's authenticated \`/v1/models\` catalog, checked August 22, 2026. Cached input is billed at the lower rate when Together's automatic prompt cache matches a prefix; otherwise the standard input rate applies. Together may change these prices, so check the live catalog for billing-critical decisions.

| Model | Together API id | Input | Output | Cached input |
| --- | --- | ---: | ---: | ---: |
${tableRows}

### Selecting a model (flag order matters)

Put \`--model\` BEFORE the harness subcommand — togetherlink consumes it there and routes to that model. \`--main\` is an exact alias of \`--model\` (same flag, same slot, all harnesses); neither one is harness-specific, and neither works after the harness name.

\`\`\`
togetherlink --model ${alternate?.id ?? DEFAULT_MODEL.id} codex exec "task"
togetherlink --model ${alternate?.id ?? DEFAULT_MODEL.id} claude -p "task"
togetherlink --main ${DEFAULT_MODEL.anthropicAlias ?? DEFAULT_MODEL.id} claude -p "task"   # --main == --model; value matches alias OR id
\`\`\`

Do NOT put \`--model\` after the harness (e.g. \`tcodex --model X\` or \`tclaude --model X\`). The short aliases expand to \`togetherlink <harness> ...\`, so the flag lands after the harness name, goes to the agent's passthrough, and is then stripped — it is silently ignored and the run uses the default (${DEFAULT_MODEL.name}), not the model you asked for. Always use the long form with the flag first.

Capabilities:

${capabilities}

Vision-capable models accept image attachments directly. The current text-only models are ${textOnlyNames}; harnesses with vision delegation use ${DEFAULT_MODEL.name} for image work.

`;

writeFileSync(docsPath, docs.slice(0, start) + section + docs.slice(end));
console.log("✓ model docs → site/public/llms.txt");
