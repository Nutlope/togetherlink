import { describe, expect, test } from "vitest";
import {
  formatUsageReport,
  parseUsageWindow,
  summarizeUsageSessions,
  type UsageSession,
} from "../../cli/src/lib/usage-report.js";

const NOW = Date.UTC(2026, 7, 14, 12);

describe("usage report", () => {
  test("parses a relative --last window", () => {
    expect(parseUsageWindow("7d", NOW)).toEqual({
      label: "Last 7 days",
      since: NOW - 7 * 24 * 60 * 60 * 1000,
    });
    expect(parseUsageWindow("12h", NOW)).toEqual({
      label: "Last 12 hours",
      since: NOW - 12 * 60 * 60 * 1000,
    });
    expect(() => parseUsageWindow("seven days", NOW)).toThrow(
      'Invalid --last value "seven days". Use a number followed by h, d, or w (for example: 7d).',
    );
  });

  test("aggregates models and the three accurately tracked integrations", () => {
    const sessions: UsageSession[] = [
      session("claude", "moonshotai/Kimi-K3", 10.25),
      session("codex", "zai-org/GLM-5.2", 7.5),
      session("codex-app", "moonshotai/Kimi-K3", 2.25),
    ];

    expect(summarizeUsageSessions(sessions)).toEqual({
      completedSessions: 3,
      promptTokens: 30,
      cachedTokens: 0,
      completionTokens: 6,
      totalCostUsd: 20,
      models: [
        {
          model: "moonshotai/Kimi-K3",
          promptTokens: 20,
          cachedTokens: 0,
          completionTokens: 4,
          costUsd: 12.5,
        },
        {
          model: "zai-org/GLM-5.2",
          promptTokens: 10,
          cachedTokens: 0,
          completionTokens: 2,
          costUsd: 7.5,
        },
      ],
      harnesses: [
        {
          agent: "claude",
          promptTokens: 10,
          cachedTokens: 0,
          completionTokens: 2,
          costUsd: 10.25,
        },
        {
          agent: "codex",
          promptTokens: 10,
          cachedTokens: 0,
          completionTokens: 2,
          costUsd: 7.5,
        },
        {
          agent: "codex-app",
          promptTokens: 10,
          cachedTokens: 0,
          completionTokens: 2,
          costUsd: 2.25,
        },
      ],
    });
  });

  test("renders a compact usage summary with one coverage note", () => {
    const report = formatUsageReport(
      summarizeUsageSessions([
        session("claude", "moonshotai/Kimi-K3", 10.25),
        session("codex-app", "zai-org/GLM-5.2", 7.5),
      ]),
      "Last 7 days",
    );

    expect(report).toBe(`TogetherLink usage · last 7 days

Cost          $17.75
Total tokens      24
Input             20
Output             4
Cached input       0
Sessions           2

Models
┌─────────┬────────┬────────┐
│  Model  │ Tokens │  Cost  │
├─────────┼────────┼────────┤
│ Kimi K3 │     12 │ $10.25 │
│ GLM 5.2 │     12 │  $7.50 │
└─────────┴────────┴────────┘

Harnesses
┌─────────────────┬────────┬────────┐
│     Harness     │ Tokens │  Cost  │
├─────────────────┼────────┼────────┤
│ Claude Code     │     12 │ $10.25 │
│ ChatGPT Desktop │     12 │  $7.50 │
└─────────────────┴────────┴────────┘

Other harnesses aren't tracked yet.`);
  });

  test("shortens provider-qualified fallback model ids", () => {
    const report = formatUsageReport(
      summarizeUsageSessions([session("codex", "deepseek-ai/DeepSeek-V4-Pro", 1)]),
      "Last 7 days",
    );

    expect(report).toContain("DeepSeek V4 Pro");
    expect(report).not.toContain("deepseek-ai/");
  });
});

function session(agent: UsageSession["agent"], model: string, costUsd: number): UsageSession {
  return {
    agent,
    costUsd,
    usageByModel: [{ model, promptTokens: 10, cachedTokens: 0, completionTokens: 2, costUsd }],
  };
}
