export type DashboardLifecycleEvent = {
  installId: string;
  sessionId?: string;
  eventType: string;
  agent?: string;
  countryCode?: string;
  receivedAt: number;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  usageByModel?: Array<unknown>;
};

/**
 * Assigns each install with real session lifecycle activity to one country:
 * the country on its latest lifecycle event in the selected range. This keeps
 * geographic install totals mutually exclusive, so the country values add up
 * to the same active-install total shown elsewhere on the dashboard.
 */
export function groupActiveInstallsByLatestCountry(events: DashboardLifecycleEvent[]) {
  const latestCountryByInstall = new Map<string, { countryCode: string; receivedAt: number }>();

  for (const event of events) {
    if (
      !event.sessionId ||
      (event.eventType !== "session_started" && event.eventType !== "session_ended")
    ) {
      continue;
    }

    const countryCode = event.countryCode?.toUpperCase() ?? "UNKNOWN";
    const existing = latestCountryByInstall.get(event.installId);
    if (!existing || event.receivedAt >= existing.receivedAt) {
      latestCountryByInstall.set(event.installId, { countryCode, receivedAt: event.receivedAt });
    }
  }

  const installsByCountry = new Map<string, Set<string>>();
  for (const [installId, { countryCode }] of latestCountryByInstall) {
    addToSetMap(installsByCountry, countryCode, installId);
  }
  return installsByCountry;
}

type LifecycleSession = {
  sessionId: string;
  installId: string;
  agent: string;
  firstSeenAt: number;
  endedAt?: number;
  usageTracked: boolean;
};

export type HarnessUsageSummary = {
  agent: string;
  activeInstalls: number;
  sessions: number;
  repeatInstalls: number;
  trackedSessions: number;
  untrackedSessions: number;
};

function normalizeAgent(agent: string | undefined): string {
  return agent === "codex-app" ? "chatgpt" : (agent ?? "unknown");
}

function eventHasUsage(event: DashboardLifecycleEvent): boolean {
  return (
    event.promptTokens !== undefined ||
    event.cachedTokens !== undefined ||
    event.completionTokens !== undefined ||
    event.costUsd !== undefined ||
    Boolean(event.usageByModel?.length)
  );
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

/**
 * Builds product-usage metrics from session lifecycle events. Session IDs are
 * the unit of work and are deduplicated before any totals are calculated, so
 * retries or duplicate telemetry deliveries cannot inflate usage.
 */
export function summarizeLifecycleActivity(
  events: DashboardLifecycleEvent[],
  options: { since?: number; bucketKey?: (timestampMs: number) => string } = {},
) {
  const since = options.since ?? Number.NEGATIVE_INFINITY;
  const sessions = new Map<string, LifecycleSession>();

  for (const event of events) {
    if (
      event.receivedAt < since ||
      !event.sessionId ||
      (event.eventType !== "session_started" && event.eventType !== "session_ended")
    ) {
      continue;
    }

    const existing = sessions.get(event.sessionId);
    const session = existing ?? {
      sessionId: event.sessionId,
      installId: event.installId,
      agent: normalizeAgent(event.agent),
      firstSeenAt: event.receivedAt,
      usageTracked: false,
    };
    session.firstSeenAt = Math.min(session.firstSeenAt, event.receivedAt);
    if (event.agent) session.agent = normalizeAgent(event.agent);
    if (event.eventType === "session_ended") {
      session.endedAt = Math.max(session.endedAt ?? event.receivedAt, event.receivedAt);
      session.usageTracked = session.usageTracked || eventHasUsage(event);
    }
    sessions.set(event.sessionId, session);
  }

  const sessionsByInstall = new Map<string, Set<string>>();
  const sessionsByAgent = new Map<string, LifecycleSession[]>();
  const activeInstallsByBucket = new Map<string, Set<string>>();
  const sessionsByBucket = new Map<string, Set<string>>();
  const endedSessionsByBucket = new Map<string, Set<string>>();
  let trackedSessions = 0;

  for (const session of sessions.values()) {
    addToSetMap(sessionsByInstall, session.installId, session.sessionId);
    const agentSessions = sessionsByAgent.get(session.agent) ?? [];
    agentSessions.push(session);
    sessionsByAgent.set(session.agent, agentSessions);
    if (session.usageTracked) trackedSessions += 1;

    if (options.bucketKey) {
      const startBucket = options.bucketKey(session.firstSeenAt);
      addToSetMap(activeInstallsByBucket, startBucket, session.installId);
      addToSetMap(sessionsByBucket, startBucket, session.sessionId);
      if (session.endedAt !== undefined) {
        addToSetMap(endedSessionsByBucket, options.bucketKey(session.endedAt), session.sessionId);
      }
    }
  }

  const harnessUsage = Array.from(sessionsByAgent.entries())
    .map(([agent, agentSessions]): HarnessUsageSummary => {
      const agentSessionsByInstall = new Map<string, Set<string>>();
      let agentTrackedSessions = 0;
      for (const session of agentSessions) {
        addToSetMap(agentSessionsByInstall, session.installId, session.sessionId);
        if (session.usageTracked) agentTrackedSessions += 1;
      }
      return {
        agent,
        activeInstalls: agentSessionsByInstall.size,
        sessions: agentSessions.length,
        repeatInstalls: Array.from(agentSessionsByInstall.values()).filter(
          (sessionIds) => sessionIds.size > 1,
        ).length,
        trackedSessions: agentTrackedSessions,
        untrackedSessions: agentSessions.length - agentTrackedSessions,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || a.agent.localeCompare(b.agent));

  const toSortedCounts = (map: Map<string, Set<string>>) =>
    Array.from(map.entries())
      .map(([day, values]) => ({ day, count: values.size }))
      .sort((a, b) => a.day.localeCompare(b.day));

  return {
    activeInstalls: sessionsByInstall.size,
    sessions: sessions.size,
    repeatInstalls: Array.from(sessionsByInstall.values()).filter(
      (sessionIds) => sessionIds.size > 1,
    ).length,
    trackedSessions,
    untrackedSessions: sessions.size - trackedSessions,
    sessionsByInstall,
    harnessUsage,
    activeInstallsByBucket: toSortedCounts(activeInstallsByBucket),
    sessionsByBucket: toSortedCounts(sessionsByBucket),
    endedSessionsByBucket: toSortedCounts(endedSessionsByBucket),
  };
}
