import { findModelById } from "@togetherlink/models";
import { createSessionStore, type TrackedUsageSession } from "./daemon/storage.js";

export type UsageSession = TrackedUsageSession;

export type UsageSummary = {
  completedSessions: number;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  models: Array<UsageBreakdown & { model: string }>;
  harnesses: Array<UsageBreakdown & { agent: UsageSession["agent"] }>;
};

type UsageBreakdown = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type UsageWindow = {
  label: string;
  since: number;
};

const WINDOW_UNITS = {
  h: { milliseconds: 60 * 60 * 1000, singular: "hour", plural: "hours" },
  d: { milliseconds: 24 * 60 * 60 * 1000, singular: "day", plural: "days" },
  w: { milliseconds: 7 * 24 * 60 * 60 * 1000, singular: "week", plural: "weeks" },
} as const;

const AGENT_LABEL: Record<UsageSession["agent"], string> = {
  claude: "Claude Code",
  codex: "Codex",
  "codex-app": "ChatGPT Desktop",
};

export function parseUsageWindow(value = "7d", now = Date.now()): UsageWindow {
  const match = /^(\d+)([hdw])$/i.exec(value.trim());
  if (!match) {
    throw invalidWindow(value);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() as keyof typeof WINDOW_UNITS;
  const definition = WINDOW_UNITS[unit];
  const duration = amount * definition.milliseconds;
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(duration)) {
    throw invalidWindow(value);
  }
  return {
    label: `Last ${amount} ${amount === 1 ? definition.singular : definition.plural}`,
    since: now - duration,
  };
}

export function summarizeUsageSessions(sessions: UsageSession[]): UsageSummary {
  const models = new Map<string, UsageBreakdown>();
  const harnesses = new Map<UsageSession["agent"], UsageBreakdown>();
  const totals = emptyUsage();
  let totalCostUsd = 0;
  for (const session of sessions) {
    totalCostUsd += session.costUsd;
    for (const usage of session.usageByModel) {
      addUsage(totals, usage);
      addUsage(getUsageBucket(models, usage.model), usage);
      addUsage(getUsageBucket(harnesses, session.agent), usage);
    }
  }
  return {
    completedSessions: sessions.length,
    promptTokens: totals.promptTokens,
    cachedTokens: totals.cachedTokens,
    completionTokens: totals.completionTokens,
    totalCostUsd,
    models: [...models.entries()]
      .map(([model, usage]) => ({ model, ...usage }))
      .sort(byCostThenKey("model")),
    harnesses: [...harnesses.entries()]
      .map(([agent, usage]) => ({ agent, ...usage }))
      .sort(byCostThenKey("agent")),
  };
}

export function formatUsageReport(summary: UsageSummary, periodLabel: string): string {
  const coverage = "Other harnesses aren't tracked yet.";
  const lines = [`TogetherLink usage · ${periodLabel.toLowerCase()}`];
  if (summary.models.length === 0) {
    lines.push("", "No completed usage.", coverage);
    return lines.join("\n");
  }

  lines.push(
    "",
    ...formatSummaryRows([
      { label: "Cost", value: formatUsd(summary.totalCostUsd) },
      { label: "Total tokens", value: formatCompactNumber(totalTokens(summary)) },
      { label: "Input", value: formatCompactNumber(summary.promptTokens) },
      { label: "Output", value: formatCompactNumber(summary.completionTokens) },
      { label: "Cached input", value: formatCompactNumber(summary.cachedTokens) },
      { label: "Sessions", value: formatTokens(summary.completedSessions) },
    ]),
  );
  const models = summary.models.map(({ model, ...usage }) => ({
    label: modelLabel(model),
    ...usage,
  }));
  const harnesses = summary.harnesses.map(({ agent, ...usage }) => ({
    label: AGENT_LABEL[agent],
    ...usage,
  }));
  lines.push("", ...formatBreakdownTable("Models", models));
  lines.push("", ...formatBreakdownTable("Harnesses", harnesses));
  lines.push("", coverage);
  return lines.join("\n");
}

export async function buildUsageReport(
  last = "7d",
  options: { home?: string; now?: number } = {},
): Promise<string> {
  const window = parseUsageWindow(last, options.now);
  const store = await createSessionStore(options.home);
  try {
    return formatUsageReport(
      summarizeUsageSessions(store.queryUsageSince(window.since)),
      window.label,
    );
  } finally {
    store.close();
  }
}

function emptyUsage(): UsageBreakdown {
  return { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
}

function getUsageBucket<Key>(map: Map<Key, UsageBreakdown>, key: Key): UsageBreakdown {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const bucket = emptyUsage();
  map.set(key, bucket);
  return bucket;
}

function addUsage(target: UsageBreakdown, usage: UsageBreakdown): void {
  target.promptTokens += usage.promptTokens;
  target.cachedTokens += usage.cachedTokens;
  target.completionTokens += usage.completionTokens;
  target.costUsd += usage.costUsd;
}

function totalTokens(usage: Pick<UsageBreakdown, "promptTokens" | "completionTokens">): number {
  return usage.promptTokens + usage.completionTokens;
}

function formatSummaryRows(rows: Array<{ label: string; value: string }>): string[] {
  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  const valueWidth = Math.max(...rows.map((row) => row.value.length));
  return rows.map((row) => `${row.label.padEnd(labelWidth)}  ${row.value.padStart(valueWidth)}`);
}

function formatBreakdownTable(
  title: string,
  rows: Array<{ label: string } & UsageBreakdown>,
): string[] {
  const rendered = rows.map((row) => ({
    label: `  ${row.label}`,
    tokens: formatCompactNumber(totalTokens(row)),
    cost: formatUsd(row.costUsd),
  }));
  const labelWidth = Math.max(title.length, ...rendered.map((row) => row.label.length));
  const tokenWidth = Math.max("Tokens".length, ...rendered.map((row) => row.tokens.length));
  const costWidth = Math.max("Cost".length, ...rendered.map((row) => row.cost.length));
  return [
    `${title.padEnd(labelWidth)}  ${"Tokens".padStart(tokenWidth)}  ${"Cost".padStart(costWidth)}`,
    ...rendered.map(
      (row) =>
        `${row.label.padEnd(labelWidth)}  ${row.tokens.padStart(tokenWidth)}  ${row.cost.padStart(costWidth)}`,
    ),
  ];
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Math.round(value));
}

function modelLabel(model: string): string {
  const known = findModelById(model)?.name;
  if (known) {
    return known;
  }
  return (model.split("/").at(-1) ?? model).replaceAll("-", " ");
}

function byCostThenKey<Key extends "model" | "agent">(
  key: Key,
): (
  a: { [K in Key]: string } & { costUsd: number },
  b: { [K in Key]: string } & { costUsd: number },
) => number {
  return (a, b) => b.costUsd - a.costUsd || a[key].localeCompare(b[key]);
}

function invalidWindow(value: string): Error {
  return new Error(
    `Invalid --last value "${value}". Use a number followed by h, d, or w (for example: 7d).`,
  );
}
