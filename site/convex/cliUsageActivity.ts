export type CliUsageEvent = {
  installId: string;
  sessionId?: string;
  eventType: string;
  cliVersion?: string;
  agent?: string;
  model?: string;
  initialModel?: string;
  finalModel?: string;
  receivedAt: number;
};

export type VersionStatus = "latest" | "newer" | "outdated" | "unknown";
export type CliUsageRange = "24h" | "7d" | "30d" | "lifetime";

const DAY_MS = 24 * 60 * 60 * 1000;

export function cliUsageRangeStart(range: CliUsageRange, now = Date.now()): number {
  if (range === "lifetime") return Number.NEGATIVE_INFINITY;
  const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
  return now - days * DAY_MS;
}

function normalizeAgent(agent: string | undefined): string {
  return agent === "codex-app" ? "chatgpt" : (agent ?? "unknown");
}

function modelLabel(event: CliUsageEvent): string {
  return event.model ?? event.finalModel ?? event.initialModel ?? "unknown";
}

function compareVersions(left: string, right: string): number | undefined {
  const parse = (version: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
    return match ? match.slice(1, 4).map(Number) : undefined;
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return undefined;
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    }
  }
  return 0;
}

export function versionStatus(version: string | undefined, latestVersion: string): VersionStatus {
  if (!version) return "unknown";
  if (version === latestVersion) return "latest";
  const comparison = compareVersions(version, latestVersion);
  if (comparison === undefined) return "unknown";
  return comparison >= 0 ? "newer" : "outdated";
}

export function summarizeCliUsage(events: CliUsageEvent[], latestVersion: string) {
  const cliStarts = events.filter((event) => event.eventType === "cli_started");
  const latestStartByInstall = new Map<string, CliUsageEvent>();
  const harnesses = new Map<string, { launches: number; installIds: Set<string> }>();
  const versionLaunches = new Map<string, number>();

  for (const event of cliStarts) {
    const current = latestStartByInstall.get(event.installId);
    if (!current || event.receivedAt >= current.receivedAt) {
      latestStartByInstall.set(event.installId, event);
    }

    const agent = normalizeAgent(event.agent);
    const harness = harnesses.get(agent) ?? { launches: 0, installIds: new Set<string>() };
    harness.launches += 1;
    harness.installIds.add(event.installId);
    harnesses.set(agent, harness);

    const version = event.cliVersion ?? "unknown";
    versionLaunches.set(version, (versionLaunches.get(version) ?? 0) + 1);
  }

  const usersByVersion = new Map<string, number>();
  const adoption = { latest: 0, newer: 0, outdated: 0, unknown: 0 };
  for (const event of latestStartByInstall.values()) {
    const version = event.cliVersion ?? "unknown";
    usersByVersion.set(version, (usersByVersion.get(version) ?? 0) + 1);
    adoption[versionStatus(event.cliVersion, latestVersion)] += 1;
  }

  const sessions = new Map<string, CliUsageEvent>();
  for (const event of events) {
    if (event.eventType !== "session_started" || !event.sessionId) continue;
    const current = sessions.get(event.sessionId);
    const currentHasModel = current ? modelLabel(current) !== "unknown" : false;
    const eventHasModel = modelLabel(event) !== "unknown";
    if (
      !current ||
      (eventHasModel && (!currentHasModel || event.receivedAt > current.receivedAt)) ||
      (!eventHasModel && !currentHasModel && event.receivedAt > current.receivedAt)
    ) {
      sessions.set(event.sessionId, event);
    }
  }

  const models = new Map<string, { sessions: number; installIds: Set<string> }>();
  for (const event of sessions.values()) {
    const model = modelLabel(event);
    const usage = models.get(model) ?? { sessions: 0, installIds: new Set<string>() };
    usage.sessions += 1;
    usage.installIds.add(event.installId);
    models.set(model, usage);
  }

  const versionUsage = Array.from(
    new Set([...versionLaunches.keys(), ...usersByVersion.keys()]),
    (version) => ({
      version,
      status: versionStatus(version === "unknown" ? undefined : version, latestVersion),
      users: usersByVersion.get(version) ?? 0,
      launches: versionLaunches.get(version) ?? 0,
    }),
  ).sort(
    (left, right) =>
      right.users - left.users ||
      right.launches - left.launches ||
      left.version.localeCompare(right.version),
  );

  return {
    latestVersion,
    totalLaunches: cliStarts.length,
    uniqueUsers: latestStartByInstall.size,
    adoption,
    versionUsage,
    harnessUsage: Array.from(harnesses, ([agent, usage]) => ({
      agent,
      launches: usage.launches,
      users: usage.installIds.size,
    })).sort(
      (left, right) => right.launches - left.launches || left.agent.localeCompare(right.agent),
    ),
    modelUsage: Array.from(models, ([model, usage]) => ({
      model,
      sessions: usage.sessions,
      users: usage.installIds.size,
    })).sort(
      (left, right) => right.sessions - left.sessions || left.model.localeCompare(right.model),
    ),
    modelSessions: sessions.size,
    knownModelSessions: Array.from(sessions.values()).filter(
      (event) => modelLabel(event) !== "unknown",
    ).length,
  };
}
