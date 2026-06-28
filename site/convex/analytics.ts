import { query } from './_generated/server'
import { v } from 'convex/values'

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

export const getDashboardSummary = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30
    const since = Date.now() - days * DAY_MS

    const events = await ctx.db
      .query('telemetryEvents')
      .withIndex('by_receivedAt', (q) => q.gte('receivedAt', since))
      .collect()

    const installsByDay = new Map<string, Set<string>>()
    const activeInstallsByDay = new Map<string, Set<string>>()
    const sessionsStartedByDay = new Map<string, number>()
    const sessionsEndedByDay = new Map<string, number>()
    const tokensByAgent = new Map<string, { promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number }>()
    const tokensByModel = new Map<string, { promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number }>()
    const osCounts = new Map<string, number>()
    const countryCounts = new Map<string, number>()
    const versionCounts = new Map<string, number>()
    let failedSessions = 0
    let totalEndedSessions = 0

    for (const event of events) {
      const day = dayKey(event.receivedAt)

      if (event.eventType === 'install_completed') {
        if (!installsByDay.has(day)) installsByDay.set(day, new Set())
        installsByDay.get(day)?.add(event.installId)
      }

      if (!activeInstallsByDay.has(day)) activeInstallsByDay.set(day, new Set())
      activeInstallsByDay.get(day)?.add(event.installId)

      if (event.eventType === 'session_started') {
        sessionsStartedByDay.set(day, (sessionsStartedByDay.get(day) ?? 0) + 1)
      }

      if (event.eventType === 'session_ended') {
        sessionsEndedByDay.set(day, (sessionsEndedByDay.get(day) ?? 0) + 1)
        totalEndedSessions += 1
        if (event.exitCode !== undefined && event.exitCode !== 0) {
          failedSessions += 1
        }
      }

      if (event.eventType === 'session_ended' || event.eventType === 'usage_report') {
        const agent = event.agent ?? 'unknown'
        const agentTotals = tokensByAgent.get(agent) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
        agentTotals.promptTokens += event.promptTokens ?? 0
        agentTotals.cachedTokens += event.cachedTokens ?? 0
        agentTotals.completionTokens += event.completionTokens ?? 0
        agentTotals.costUsd += event.costUsd ?? 0
        tokensByAgent.set(agent, agentTotals)

        const model = event.model ?? event.finalModel ?? event.initialModel ?? 'unknown'
        const modelTotals = tokensByModel.get(model) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
        modelTotals.promptTokens += event.promptTokens ?? 0
        modelTotals.cachedTokens += event.cachedTokens ?? 0
        modelTotals.completionTokens += event.completionTokens ?? 0
        modelTotals.costUsd += event.costUsd ?? 0
        tokensByModel.set(model, modelTotals)
      }

      osCounts.set(event.os, (osCounts.get(event.os) ?? 0) + 1)
      countryCounts.set(event.countryCode, (countryCounts.get(event.countryCode) ?? 0) + 1)
      if (event.cliVersion) {
        versionCounts.set(event.cliVersion, (versionCounts.get(event.cliVersion) ?? 0) + 1)
      }
    }

    const toSortedDayCounts = (map: Map<string, Set<string> | number>) =>
      Array.from(map.entries())
        .map(([day, value]) => ({ day, count: value instanceof Set ? value.size : value }))
        .sort((a, b) => (a.day < b.day ? -1 : 1))

    return {
      installsPerDay: toSortedDayCounts(installsByDay),
      activeInstallsPerDay: toSortedDayCounts(activeInstallsByDay),
      sessionsStartedPerDay: toSortedDayCounts(sessionsStartedByDay),
      sessionsEndedPerDay: toSortedDayCounts(sessionsEndedByDay),
      tokenUsageByAgent: Array.from(tokensByAgent.entries()).map(([agent, totals]) => ({ agent, ...totals })),
      tokenUsageByModel: Array.from(tokensByModel.entries()).map(([model, totals]) => ({ model, ...totals })),
      osDistribution: Array.from(osCounts.entries()).map(([os, count]) => ({ os, count })),
      countryDistribution: Array.from(countryCounts.entries())
        .map(([countryCode, count]) => ({ countryCode, count }))
        .sort((a, b) => b.count - a.count),
      versionDistribution: Array.from(versionCounts.entries()).map(([version, count]) => ({ version, count })),
      failedSessionRate: totalEndedSessions > 0 ? failedSessions / totalEndedSessions : 0,
      totalEvents: events.length,
    }
  },
})
