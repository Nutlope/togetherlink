import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { groupUniqueUsersByLatestCountry, summarizeLifecycleActivity } from "./dashboardActivity";
import { filterDashboardEvents } from "./dashboardFilters";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type DashboardRange = "24h" | "7d" | "30d" | "lifetime";

function bucketKey(timestampMs: number, range: DashboardRange): string {
  const iso = new Date(timestampMs).toISOString();
  return range === "24h" ? `${iso.slice(0, 13)}:00` : iso.slice(0, 10);
}

// The standalone Codex desktop app merged into the ChatGPT desktop app in 2026.
// Normalize the legacy "codex-app" agent id to "chatgpt" so both historical and
// new sessions are reported under the current name in the dashboard.
function normalizeAgent(agent: string): string {
  return agent === "codex-app" ? "chatgpt" : agent;
}

type UsageTotals = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
};

type InstallSummary = UsageTotals & {
  installId: string;
  nickname?: string;
  eventCount: number;
  sessionStarts: number;
  sessionEnds: number;
  failedSessions: number;
  firstSeenAt: number;
  lastSeenAt: number;
  os: string;
  countryCode: string;
  latestVersion?: string;
  agents: Set<string>;
  versions: Set<string>;
};

type SessionSummary = UsageTotals & {
  sessionId: string;
  installId: string;
  installNickname?: string;
  agent: string;
  model: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  exitCode?: number;
  lastEventAt: number;
  status: "started" | "ended";
  usageTracked: boolean;
};

type InstallDailySummary = UsageTotals & {
  installId: string;
  day: string;
  sessionsStarted: number;
  sessionsEnded: number;
};

function emptyUsage(): UsageTotals {
  return { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
}

function addUsage(target: UsageTotals, source: Partial<UsageTotals>) {
  target.promptTokens += source.promptTokens ?? 0;
  target.cachedTokens += source.cachedTokens ?? 0;
  target.completionTokens += source.completionTokens ?? 0;
  target.costUsd += source.costUsd ?? 0;
}

function modelLabel(event: { model?: string; finalModel?: string; initialModel?: string }) {
  return event.model ?? event.finalModel ?? event.initialModel ?? "unknown";
}

function isCountryCode(countryCode: string): boolean {
  return /^[A-Z]{2}$/.test(countryCode);
}

function eventHasUsage(event: {
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  usageByModel?: Array<unknown>;
}): boolean {
  return (
    event.promptTokens !== undefined ||
    event.cachedTokens !== undefined ||
    event.completionTokens !== undefined ||
    event.costUsd !== undefined ||
    Boolean(event.usageByModel?.length)
  );
}

export const getDashboardSummary = query({
  args: {
    range: v.optional(
      v.union(v.literal("24h"), v.literal("7d"), v.literal("30d"), v.literal("lifetime")),
    ),
    installId: v.optional(v.string()),
    excludedInstallId: v.optional(v.string()),
    excludedInstallIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const range = args.range ?? "30d";
    const excludedInstallId = args.excludedInstallId?.trim() || undefined;
    const hiddenInstallIds = new Set(
      [excludedInstallId, ...(args.excludedInstallIds ?? [])]
        .map((installId) => installId?.trim())
        .filter((installId): installId is string => Boolean(installId)),
    );
    const requestedInstallId = args.installId?.trim() || undefined;
    const selectedInstallId =
      requestedInstallId && !hiddenInstallIds?.has(requestedInstallId)
        ? requestedInstallId
        : undefined;
    const rangeDurationMs =
      range === "24h" ? 24 * HOUR_MS : range === "7d" ? 7 * DAY_MS : 30 * DAY_MS;
    const since = range === "lifetime" ? Number.NEGATIVE_INFINITY : Date.now() - rangeDurationMs;

    const allEvents = await ctx.db.query("telemetryEvents").withIndex("by_receivedAt").collect();
    const candidateAllScopedEvents = filterDashboardEvents(allEvents, {
      since: Number.NEGATIVE_INFINITY,
      installId: selectedInstallId,
      excludedInstallIds: hiddenInstallIds,
    });
    const qualification = summarizeLifecycleActivity(candidateAllScopedEvents);
    const likelyUserIds = qualification.likelyUserIds;
    const allScopedEvents = candidateAllScopedEvents.filter((event) =>
      likelyUserIds.has(event.installId),
    );
    const events = filterDashboardEvents(allEvents, {
      since,
      installId: selectedInstallId,
      excludedInstallIds: hiddenInstallIds,
    }).filter((event) => likelyUserIds.has(event.installId));
    const lifecycle = summarizeLifecycleActivity(events, {
      bucketKey: (timestampMs) => bucketKey(timestampMs, range),
    });
    const now = Date.now();
    const lifetimeLifecycle = summarizeLifecycleActivity(allScopedEvents);
    const lifetimeSessionCosts = new Map<string, { installId: string; costUsd: number }>();
    for (const event of allScopedEvents) {
      if (event.eventType !== "session_ended" || !event.sessionId) continue;
      lifetimeSessionCosts.set(event.sessionId, {
        installId: event.installId,
        costUsd: event.costUsd ?? 0,
      });
    }
    const lifetimeCostByUser = new Map<string, number>();
    for (const session of lifetimeSessionCosts.values()) {
      lifetimeCostByUser.set(
        session.installId,
        (lifetimeCostByUser.get(session.installId) ?? 0) + session.costUsd,
      );
    }
    const audience = {
      dau: summarizeLifecycleActivity(allScopedEvents, { since: now - DAY_MS }).activeInstalls,
      wau: summarizeLifecycleActivity(allScopedEvents, { since: now - 7 * DAY_MS }).activeInstalls,
      mau: summarizeLifecycleActivity(allScopedEvents, { since: now - 30 * DAY_MS }).activeInstalls,
      lifetimeUniqueUsers: lifetimeLifecycle.uniqueUsers,
      lifetimeReturningUsers: lifetimeLifecycle.returningUsers,
      lifetimeTrackedUsers: lifetimeLifecycle.trackedUsers,
      lifetimeUsersOverOneDollar: Array.from(lifetimeCostByUser.values()).filter(
        (costUsd) => costUsd > 1,
      ).length,
      lifetimeActiveInstalls: lifetimeLifecycle.activeInstalls,
      lifetimeSessions: lifetimeLifecycle.sessions,
      lifetimeRepeatInstalls: lifetimeLifecycle.repeatInstalls,
    };

    const nicknameRows = await ctx.db.query("installNicknames").collect();
    const nicknames = new Map(nicknameRows.map((row) => [row.installId, row.nickname]));
    const installFilterOptionsById = new Map<
      string,
      { installId: string; nickname?: string; lastSeenAt: number }
    >();
    for (const event of allEvents) {
      if (hiddenInstallIds.has(event.installId) || !likelyUserIds.has(event.installId)) continue;
      const existing = installFilterOptionsById.get(event.installId);
      if (!existing || event.receivedAt > existing.lastSeenAt) {
        installFilterOptionsById.set(event.installId, {
          installId: event.installId,
          nickname: nicknames.get(event.installId),
          lastSeenAt: event.receivedAt,
        });
      }
    }

    const installsByDay = new Map<string, Set<string>>();
    const tokensByAgent = new Map<
      string,
      { promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number }
    >();
    const tokensByModel = new Map<
      string,
      { promptTokens: number; cachedTokens: number; completionTokens: number; costUsd: number }
    >();
    const installs = new Map<string, InstallSummary>();
    const sessions = new Map<string, SessionSummary>();
    const installDaily = new Map<string, InstallDailySummary>();
    const installIds = new Set<string>();
    const usage = emptyUsage();
    const countryActivity = new Map<
      string,
      UsageTotals & {
        installCompletionIds: Set<string>;
        uniqueInstallIds: Set<string>;
        activeInstallIds: Set<string>;
        sessionsStarted: number;
        sessionsEnded: number;
      }
    >();
    const installCompletionIds = new Set<string>();
    const countedStartedSessionIds = new Set<string>();
    const countedEndedSessionIds = new Set<string>();
    let failedSessions = 0;
    let totalEndedSessions = 0;

    for (const event of events) {
      const day = bucketKey(event.receivedAt, range);
      const countryCode = event.countryCode.toUpperCase();
      installIds.add(event.installId);

      const country = countryActivity.get(countryCode) ?? {
        ...emptyUsage(),
        installCompletionIds: new Set<string>(),
        uniqueInstallIds: new Set<string>(),
        activeInstallIds: new Set<string>(),
        sessionsStarted: 0,
        sessionsEnded: 0,
      };
      country.uniqueInstallIds.add(event.installId);

      const install = installs.get(event.installId) ?? {
        installId: event.installId,
        nickname: nicknames.get(event.installId),
        ...emptyUsage(),
        eventCount: 0,
        sessionStarts: 0,
        sessionEnds: 0,
        failedSessions: 0,
        firstSeenAt: event.receivedAt,
        lastSeenAt: event.receivedAt,
        os: event.os,
        countryCode: event.countryCode,
        latestVersion: event.cliVersion,
        agents: new Set<string>(),
        versions: new Set<string>(),
      };
      install.eventCount += 1;
      install.firstSeenAt = Math.min(install.firstSeenAt, event.receivedAt);
      install.lastSeenAt = Math.max(install.lastSeenAt, event.receivedAt);
      install.os = event.os;
      install.countryCode = event.countryCode;
      if (event.agent) install.agents.add(normalizeAgent(event.agent));
      if (event.cliVersion) {
        install.latestVersion = event.cliVersion;
        install.versions.add(event.cliVersion);
      }
      installs.set(event.installId, install);

      const dailyKey = `${event.installId}:${day}`;
      const daily = installDaily.get(dailyKey) ?? {
        installId: event.installId,
        day,
        sessionsStarted: 0,
        sessionsEnded: 0,
        ...emptyUsage(),
      };
      installDaily.set(dailyKey, daily);

      if (event.eventType === "install_completed") {
        if (!installsByDay.has(day)) installsByDay.set(day, new Set());
        installsByDay.get(day)?.add(event.installId);
        installCompletionIds.add(event.installId);
        country.installCompletionIds.add(event.installId);
      }

      if (
        event.eventType === "session_started" &&
        event.sessionId &&
        !countedStartedSessionIds.has(event.sessionId)
      ) {
        countedStartedSessionIds.add(event.sessionId);
        country.sessionsStarted += 1;
        install.sessionStarts += 1;
        daily.sessionsStarted += 1;
      }

      if (
        event.eventType === "session_ended" &&
        event.sessionId &&
        !countedEndedSessionIds.has(event.sessionId)
      ) {
        countedEndedSessionIds.add(event.sessionId);
        totalEndedSessions += 1;
        install.sessionEnds += 1;
        daily.sessionsEnded += 1;
        if (event.exitCode !== undefined && event.exitCode !== 0) {
          failedSessions += 1;
          install.failedSessions += 1;
        }
        country.sessionsEnded += 1;
      }

      if (
        event.sessionId &&
        (event.eventType === "session_started" || event.eventType === "session_ended")
      ) {
        const session = sessions.get(event.sessionId) ?? {
          sessionId: event.sessionId,
          installId: event.installId,
          installNickname: nicknames.get(event.installId),
          ...emptyUsage(),
          agent: normalizeAgent(event.agent ?? "unknown"),
          model: modelLabel(event),
          lastEventAt: event.receivedAt,
          status: "started",
          usageTracked: false,
        };

        session.agent = event.agent ? normalizeAgent(event.agent) : session.agent;
        session.model = modelLabel(event);
        session.lastEventAt = Math.max(session.lastEventAt, event.receivedAt);

        if (event.eventType === "session_started") {
          session.startedAt = event.startedAt ?? event.receivedAt;
        }

        if (event.eventType === "session_ended") {
          session.status = "ended";
          session.endedAt = event.endedAt ?? event.receivedAt;
          session.durationMs = event.durationMs;
          session.exitCode = event.exitCode;
          session.usageTracked = session.usageTracked || eventHasUsage(event);
          addUsage(session, event);
        }

        sessions.set(event.sessionId, session);
      }

      if (event.eventType === "session_ended" && eventHasUsage(event)) {
        const agent = normalizeAgent(event.agent ?? "unknown");
        const agentTotals = tokensByAgent.get(agent) ?? {
          promptTokens: 0,
          cachedTokens: 0,
          completionTokens: 0,
          costUsd: 0,
        };
        agentTotals.promptTokens += event.promptTokens ?? 0;
        agentTotals.cachedTokens += event.cachedTokens ?? 0;
        agentTotals.completionTokens += event.completionTokens ?? 0;
        agentTotals.costUsd += event.costUsd ?? 0;
        tokensByAgent.set(agent, agentTotals);

        // Prefer the real per-model breakdown reported by the proxy (accounts
        // for in-session model switches). Older CLI versions don't send it, so
        // fall back to the launch-time model as a best-effort guess.
        if (event.usageByModel && event.usageByModel.length > 0) {
          for (const entry of event.usageByModel) {
            const modelTotals = tokensByModel.get(entry.model) ?? {
              promptTokens: 0,
              cachedTokens: 0,
              completionTokens: 0,
              costUsd: 0,
            };
            modelTotals.promptTokens += entry.promptTokens ?? 0;
            modelTotals.cachedTokens += entry.cachedTokens ?? 0;
            modelTotals.completionTokens += entry.completionTokens ?? 0;
            modelTotals.costUsd += entry.costUsd ?? 0;
            tokensByModel.set(entry.model, modelTotals);
          }
        } else {
          const model = event.model ?? event.finalModel ?? event.initialModel ?? "unknown";
          const modelTotals = tokensByModel.get(model) ?? {
            promptTokens: 0,
            cachedTokens: 0,
            completionTokens: 0,
            costUsd: 0,
          };
          modelTotals.promptTokens += event.promptTokens ?? 0;
          modelTotals.cachedTokens += event.cachedTokens ?? 0;
          modelTotals.completionTokens += event.completionTokens ?? 0;
          modelTotals.costUsd += event.costUsd ?? 0;
          tokensByModel.set(model, modelTotals);
        }

        addUsage(install, event);
        addUsage(daily, event);
        addUsage(usage, event);
        addUsage(country, event);
      }

      countryActivity.set(countryCode, country);
    }

    // Country install counts must use the same mutually exclusive population
    // as overview.activeInstalls. Assigning an install to every country where
    // it emitted an event makes the map impossible to reconcile with the
    // headline total when a user travels or uses a VPN.
    const activeInstallsByCountry = groupUniqueUsersByLatestCountry(events);
    for (const country of countryActivity.values()) {
      country.activeInstallIds.clear();
    }
    for (const [countryCode, activeInstallIds] of activeInstallsByCountry) {
      const country = countryActivity.get(countryCode) ?? {
        ...emptyUsage(),
        installCompletionIds: new Set<string>(),
        uniqueInstallIds: new Set<string>(),
        activeInstallIds: new Set<string>(),
        sessionsStarted: 0,
        sessionsEnded: 0,
      };
      country.activeInstallIds = activeInstallIds;
      countryActivity.set(countryCode, country);
    }
    const activeCountryCount = Array.from(activeInstallsByCountry.keys()).filter(
      isCountryCode,
    ).length;

    const toSortedDayCounts = (map: Map<string, Set<string> | number>) =>
      Array.from(map.entries())
        .map(([day, value]) => ({ day, count: value instanceof Set ? value.size : value }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
    const userSummaries = Array.from(installs.values())
      .map(({ agents, versions, ...install }) => ({
        ...install,
        sessionStarts: lifecycle.sessionsByInstall.get(install.installId)?.size ?? 0,
        agents: Array.from(agents).sort(),
        versions: Array.from(versions).sort(),
      }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    const countUsersBy = (
      valueFor: (user: (typeof userSummaries)[number]) => string | undefined,
    ) => {
      const counts = new Map<string, number>();
      for (const user of userSummaries) {
        const value = valueFor(user);
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };

    return {
      range,
      selectedInstallId: selectedInstallId ?? "all",
      installFilterOptions: Array.from(installFilterOptionsById.values()).sort(
        (a, b) => b.lastSeenAt - a.lastSeenAt,
      ),
      overview: {
        uniqueUsers: lifecycle.uniqueUsers,
        returningUsers: lifecycle.returningUsers,
        trackedUsers: lifecycle.trackedUsers,
        usersOverOneDollar: userSummaries.filter((user) => user.costUsd > 1).length,
        installCompletions: installCompletionIds.size,
        uniqueInstalls: installIds.size,
        activeInstalls: lifecycle.activeInstalls,
        sessionsStarted: lifecycle.sessions,
        sessions: lifecycle.sessions,
        repeatInstalls: lifecycle.repeatInstalls,
        trackedSessions: lifecycle.trackedSessions,
        untrackedSessions: lifecycle.untrackedSessions,
        countries: activeCountryCount,
        usage,
      },
      audience,
      harnessUsage: lifecycle.harnessUsage,
      countryLifetime: Array.from(countryActivity.entries())
        .map(([countryCode, country]) => ({
          countryCode,
          installCompletions: country.installCompletionIds.size,
          uniqueInstalls: country.uniqueInstallIds.size,
          uniqueUsers: country.activeInstallIds.size,
          activeInstalls: country.activeInstallIds.size,
          sessionsStarted: country.sessionsStarted,
          sessionsEnded: country.sessionsEnded,
          promptTokens: country.promptTokens,
          cachedTokens: country.cachedTokens,
          completionTokens: country.completionTokens,
          costUsd: country.costUsd,
        }))
        .sort(
          (a, b) => b.activeInstalls - a.activeInstalls || b.sessionsStarted - a.sessionsStarted,
        ),
      installsPerDay: toSortedDayCounts(installsByDay),
      activeInstallsPerDay: lifecycle.activeInstallsByBucket,
      uniqueUsersPerDay: lifecycle.uniqueUsersByBucket,
      sessionsStartedPerDay: lifecycle.sessionsByBucket,
      sessionsEndedPerDay: lifecycle.endedSessionsByBucket,
      tokenUsageByAgent: Array.from(tokensByAgent.entries())
        .map(([agent, totals]) => ({
          agent,
          ...totals,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      tokenUsageByModel: Array.from(tokensByModel.entries())
        .map(([model, totals]) => ({
          model,
          ...totals,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      osDistribution: countUsersBy((user) => user.os).map(({ label: os, count }) => ({
        os,
        count,
      })),
      countryDistribution: countUsersBy((user) => user.countryCode.toUpperCase()).map(
        ({ label: countryCode, count }) => ({ countryCode, count }),
      ),
      versionDistribution: countUsersBy((user) => user.latestVersion).map(
        ({ label: version, count }) => ({ version, count }),
      ),
      userSummaries,
      installSummaries: userSummaries,
      installDaily: Array.from(installDaily.values()).sort((a, b) =>
        a.installId === b.installId ? (a.day < b.day ? -1 : 1) : a.installId < b.installId ? -1 : 1,
      ),
      recentSessions: Array.from(sessions.values())
        .sort((a, b) => b.lastEventAt - a.lastEventAt)
        .slice(0, 200),
      failedSessionRate: totalEndedSessions > 0 ? failedSessions / totalEndedSessions : 0,
      totalEvents: events.length,
    };
  },
});

export const setInstallNickname = mutation({
  args: {
    installId: v.string(),
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const installId = args.installId.trim();
    const nickname = args.nickname.trim();
    if (!installId) {
      throw new Error("Install ID is required");
    }

    const existing = await ctx.db
      .query("installNicknames")
      .withIndex("by_installId", (q) => q.eq("installId", installId))
      .collect();

    if (!nickname) {
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
      return { ok: true };
    }

    const now = Date.now();
    const [first, ...duplicates] = existing;
    if (first) {
      await ctx.db.patch(first._id, { nickname, updatedAt: now });
      await Promise.all(duplicates.map((row) => ctx.db.delete(row._id)));
    } else {
      await ctx.db.insert("installNicknames", {
        installId,
        nickname,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});
