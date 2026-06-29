import { query } from './_generated/server'
import { v } from 'convex/values'

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

type UsageTotals = {
  promptTokens: number
  cachedTokens: number
  completionTokens: number
  costUsd: number
}

type InstallSummary = UsageTotals & {
  installId: string
  eventCount: number
  sessionStarts: number
  sessionEnds: number
  failedSessions: number
  firstSeenAt: number
  lastSeenAt: number
  os: string
  countryCode: string
  agents: Set<string>
  versions: Set<string>
}

type SessionSummary = UsageTotals & {
  sessionId: string
  installId: string
  agent: string
  model: string
  startedAt?: number
  endedAt?: number
  durationMs?: number
  exitCode?: number
  lastEventAt: number
  status: 'started' | 'ended'
}

type InstallDailySummary = UsageTotals & {
  installId: string
  day: string
  sessionsStarted: number
  sessionsEnded: number
}

function emptyUsage(): UsageTotals {
  return { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
}

function addUsage(target: UsageTotals, source: Partial<UsageTotals>) {
  target.promptTokens += source.promptTokens ?? 0
  target.cachedTokens += source.cachedTokens ?? 0
  target.completionTokens += source.completionTokens ?? 0
  target.costUsd += source.costUsd ?? 0
}

function modelLabel(event: { model?: string; finalModel?: string; initialModel?: string }) {
  return event.model ?? event.finalModel ?? event.initialModel ?? 'unknown'
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
    const installs = new Map<string, InstallSummary>()
    const sessions = new Map<string, SessionSummary>()
    const installDaily = new Map<string, InstallDailySummary>()
    let failedSessions = 0
    let totalEndedSessions = 0

    for (const event of events) {
      const day = dayKey(event.receivedAt)
      const install =
        installs.get(event.installId) ??
        {
          installId: event.installId,
          ...emptyUsage(),
          eventCount: 0,
          sessionStarts: 0,
          sessionEnds: 0,
          failedSessions: 0,
          firstSeenAt: event.receivedAt,
          lastSeenAt: event.receivedAt,
          os: event.os,
          countryCode: event.countryCode,
          agents: new Set<string>(),
          versions: new Set<string>(),
        }
      install.eventCount += 1
      install.firstSeenAt = Math.min(install.firstSeenAt, event.receivedAt)
      install.lastSeenAt = Math.max(install.lastSeenAt, event.receivedAt)
      install.os = event.os
      install.countryCode = event.countryCode
      if (event.agent) install.agents.add(event.agent)
      if (event.cliVersion) install.versions.add(event.cliVersion)
      installs.set(event.installId, install)

      const dailyKey = `${event.installId}:${day}`
      const daily =
        installDaily.get(dailyKey) ??
        {
          installId: event.installId,
          day,
          sessionsStarted: 0,
          sessionsEnded: 0,
          ...emptyUsage(),
        }
      installDaily.set(dailyKey, daily)

      if (event.eventType === 'install_completed') {
        if (!installsByDay.has(day)) installsByDay.set(day, new Set())
        installsByDay.get(day)?.add(event.installId)
      }

      if (!activeInstallsByDay.has(day)) activeInstallsByDay.set(day, new Set())
      activeInstallsByDay.get(day)?.add(event.installId)

      if (event.eventType === 'session_started') {
        sessionsStartedByDay.set(day, (sessionsStartedByDay.get(day) ?? 0) + 1)
        install.sessionStarts += 1
        daily.sessionsStarted += 1
      }

      if (event.eventType === 'session_ended') {
        sessionsEndedByDay.set(day, (sessionsEndedByDay.get(day) ?? 0) + 1)
        totalEndedSessions += 1
        install.sessionEnds += 1
        daily.sessionsEnded += 1
        if (event.exitCode !== undefined && event.exitCode !== 0) {
          failedSessions += 1
          install.failedSessions += 1
        }
      }

      if (event.sessionId && (event.eventType === 'session_started' || event.eventType === 'session_ended')) {
        const session =
          sessions.get(event.sessionId) ??
          {
            sessionId: event.sessionId,
            installId: event.installId,
            ...emptyUsage(),
            agent: event.agent ?? 'unknown',
            model: modelLabel(event),
            lastEventAt: event.receivedAt,
            status: 'started',
          }

        session.agent = event.agent ?? session.agent
        session.model = modelLabel(event)
        session.lastEventAt = Math.max(session.lastEventAt, event.receivedAt)

        if (event.eventType === 'session_started') {
          session.startedAt = event.startedAt ?? event.receivedAt
        }

        if (event.eventType === 'session_ended') {
          session.status = 'ended'
          session.endedAt = event.endedAt ?? event.receivedAt
          session.durationMs = event.durationMs
          session.exitCode = event.exitCode
          addUsage(session, event)
        }

        sessions.set(event.sessionId, session)
      }

      if (event.eventType === 'session_ended') {
        const agent = event.agent ?? 'unknown'
        const agentTotals = tokensByAgent.get(agent) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
        agentTotals.promptTokens += event.promptTokens ?? 0
        agentTotals.cachedTokens += event.cachedTokens ?? 0
        agentTotals.completionTokens += event.completionTokens ?? 0
        agentTotals.costUsd += event.costUsd ?? 0
        tokensByAgent.set(agent, agentTotals)

        // Prefer the real per-model breakdown reported by the proxy (accounts
        // for in-session model switches). Older CLI versions don't send it, so
        // fall back to the launch-time model as a best-effort guess.
        if (event.usageByModel && event.usageByModel.length > 0) {
          for (const entry of event.usageByModel) {
            const modelTotals = tokensByModel.get(entry.model) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
            modelTotals.promptTokens += entry.promptTokens ?? 0
            modelTotals.cachedTokens += entry.cachedTokens ?? 0
            modelTotals.completionTokens += entry.completionTokens ?? 0
            modelTotals.costUsd += entry.costUsd ?? 0
            tokensByModel.set(entry.model, modelTotals)
          }
        } else {
          const model = event.model ?? event.finalModel ?? event.initialModel ?? 'unknown'
          const modelTotals = tokensByModel.get(model) ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 }
          modelTotals.promptTokens += event.promptTokens ?? 0
          modelTotals.cachedTokens += event.cachedTokens ?? 0
          modelTotals.completionTokens += event.completionTokens ?? 0
          modelTotals.costUsd += event.costUsd ?? 0
          tokensByModel.set(model, modelTotals)
        }

        addUsage(install, event)
        addUsage(daily, event)
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
      installSummaries: Array.from(installs.values())
        .map(({ agents, versions, ...install }) => ({
          ...install,
          agents: Array.from(agents).sort(),
          versions: Array.from(versions).sort(),
        }))
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
      installDaily: Array.from(installDaily.values()).sort((a, b) =>
        a.installId === b.installId ? (a.day < b.day ? -1 : 1) : a.installId < b.installId ? -1 : 1,
      ),
      recentSessions: Array.from(sessions.values())
        .sort((a, b) => b.lastEventAt - a.lastEventAt)
        .slice(0, 200),
      failedSessionRate: totalEndedSessions > 0 ? failedSessions / totalEndedSessions : 0,
      totalEvents: events.length,
    }
  },
})
