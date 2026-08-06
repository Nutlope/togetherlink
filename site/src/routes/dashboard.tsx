import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { ConvexHttpClient } from "convex/browser";
import { useEffect, useRef, useState } from "react";
import WorldMap, { regions, type ISOCode } from "react-svg-worldmap";
import { api } from "../../convex/_generated/api";
import { parseInstallIdList } from "../../convex/dashboardFilters";

type DashboardSummary = Awaited<ReturnType<typeof fetchSummary>>;
type DashboardData = NonNullable<DashboardSummary>;
type InstallSummary = DashboardData["installSummaries"][number];
type RecentSession = DashboardData["recentSessions"][number];
type CountryLifetime = DashboardData["countryLifetime"][number];
type DailyActiveUsers = DashboardData["activeInstallsPerDay"][number];
type InstallFilterOption = DashboardData["installFilterOptions"][number];
type Audience = DashboardData["audience"];
type MapMetric = "installs" | "sessions" | "tokens" | "cost";
type LeaderboardMetric = "tokens" | "sessions";
type DashboardRange = "24h" | "7d" | "30d" | "lifetime";
type DashboardFilters = { range: DashboardRange; installId?: string; hideInternal?: boolean };

const WORLD_MAP_COUNTRY_CODES = new Set(regions.map((region) => region.code.toUpperCase()));
const REFRESH_INTERVAL_MS = 15_000;
const RECENT_SESSIONS_LIMIT = 10;
const DASHBOARD_RANGES: Array<{ value: DashboardRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "lifetime", label: "Lifetime" },
];
const EMPTY_USAGE = {
  promptTokens: 0,
  cachedTokens: 0,
  completionTokens: 0,
  costUsd: 0,
};

async function dashboardSession() {
  return useSession<{ authed?: boolean }>({
    name: "togetherlink-dashboard",
    password: process.env.DASHBOARD_SESSION_SECRET ?? "togetherlink-dashboard-dev-secret-change-me",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
}

async function fetchSummary(filters: DashboardFilters) {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!url) {
    return null;
  }
  const { hideInternal, ...queryFilters } = filters;
  const internalInstallIds = configuredInternalInstallIds();
  if (hideInternal && internalInstallIds.length === 0) {
    throw new Error("Internal install IDs are not configured");
  }
  const client = new ConvexHttpClient(url);
  return client.query(api.analytics.getDashboardSummary, {
    ...queryFilters,
    ...(hideInternal ? { excludedInstallIds: internalInstallIds } : {}),
  });
}

function configuredInternalInstallIds(): string[] {
  return parseInstallIdList(
    process.env.DASHBOARD_ADMIN_INSTALL_ID,
    process.env.DASHBOARD_INTERNAL_INSTALL_IDS,
  );
}

function normalizeDashboardData(value: unknown): DashboardSummary {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<DashboardData>;
  const activeInstalls =
    data.overview?.activeInstalls ??
    (data.installSummaries ?? []).filter(
      (install) => install.sessionStarts > 0 || install.sessionEnds > 0,
    ).length;
  return {
    range: data.range ?? "30d",
    selectedInstallId: data.selectedInstallId ?? "all",
    installFilterOptions:
      data.installFilterOptions ??
      (data.installSummaries ?? []).map((install) => ({
        installId: install.installId,
        nickname: install.nickname,
        lastSeenAt: install.lastSeenAt,
      })),
    overview: {
      installCompletions: data.overview?.installCompletions ?? 0,
      uniqueInstalls: data.overview?.uniqueInstalls ?? (data.installSummaries ?? []).length,
      activeInstalls,
      sessionsStarted: data.overview?.sessionsStarted ?? 0,
      sessions: data.overview?.sessions ?? data.overview?.sessionsStarted ?? 0,
      repeatInstalls: data.overview?.repeatInstalls ?? 0,
      trackedSessions: data.overview?.trackedSessions ?? 0,
      untrackedSessions: data.overview?.untrackedSessions ?? 0,
      countries: data.overview?.countries ?? 0,
      usage: data.overview?.usage ?? EMPTY_USAGE,
    },
    audience: data.audience ?? {
      dau: 0,
      wau: 0,
      mau: 0,
      lifetimeActiveInstalls: activeInstalls,
      lifetimeSessions: data.overview?.sessionsStarted ?? 0,
      lifetimeRepeatInstalls: 0,
    },
    harnessUsage: data.harnessUsage ?? [],
    countryLifetime: data.countryLifetime ?? [],
    installsPerDay: data.installsPerDay ?? [],
    activeInstallsPerDay: data.activeInstallsPerDay ?? [],
    sessionsStartedPerDay: data.sessionsStartedPerDay ?? [],
    sessionsEndedPerDay: data.sessionsEndedPerDay ?? [],
    tokenUsageByAgent: data.tokenUsageByAgent ?? [],
    tokenUsageByModel: data.tokenUsageByModel ?? [],
    osDistribution: data.osDistribution ?? [],
    countryDistribution: data.countryDistribution ?? [],
    versionDistribution: data.versionDistribution ?? [],
    installSummaries: data.installSummaries ?? [],
    installDaily: data.installDaily ?? [],
    recentSessions: data.recentSessions ?? [],
    failedSessionRate: data.failedSessionRate ?? 0,
    totalEvents: data.totalEvents ?? 0,
  };
}

const checkDashboardAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = await dashboardSession();
  return {
    authed: Boolean(session.data.authed),
    hasInternalExclusions: configuredInternalInstallIds().length > 0,
  };
});

const loginToDashboard = createServerFn({ method: "POST" })
  .validator((password: string) => password)
  .handler(async ({ data: password }) => {
    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected || password !== expected) {
      throw new Error("Invalid password");
    }
    const session = await dashboardSession();
    await session.update({ authed: true });
    return { ok: true };
  });

const getDashboardData = createServerFn({ method: "GET" })
  .validator((filters: DashboardFilters) => filters)
  .handler(async ({ data: filters }) => {
    const session = await dashboardSession();
    if (!session.data.authed) {
      throw new Error("Not authorized");
    }
    return fetchSummary(filters);
  });

const saveInstallNickname = createServerFn({ method: "POST" })
  .validator((payload: { installId: string; nickname: string }) => payload)
  .handler(async ({ data: payload }) => {
    const session = await dashboardSession();
    if (!session.data.authed) {
      throw new Error("Not authorized");
    }

    const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
    if (!url) {
      throw new Error("Convex URL is not configured");
    }

    const client = new ConvexHttpClient(url);
    return client.mutation(api.analytics.setInstallNickname, payload);
  });

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "togetherlink analytics" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  loader: async () => checkDashboardAuth(),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { authed, hasInternalExclusions } = Route.useLoaderData();
  const [isAuthed, setIsAuthed] = useState(authed);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // `loading` only covers the very first fetch (full-page spinner state).
  // `refreshing` covers every poll after that — it never unmounts the
  // existing tables, so a 15s refresh can't cause a layout shift.
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [selectedInstallId, setSelectedInstallId] = useState("all");
  const [range, setRange] = useState<DashboardRange>("30d");
  const [hideInternal, setHideInternal] = useState(hasInternalExclusions);
  const latestRequestRef = useRef(0);

  const loadData = async (
    requestedRange: DashboardRange,
    requestedInstallId: string,
    shouldHideInternal: boolean,
    isFirstLoad: boolean,
  ) => {
    const requestId = ++latestRequestRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const filters: DashboardFilters = {
        range: requestedRange,
        ...(requestedInstallId === "all" ? {} : { installId: requestedInstallId }),
        ...(shouldHideInternal ? { hideInternal: true } : {}),
      };
      const result = normalizeDashboardData(await getDashboardData({ data: filters }));
      if (requestId !== latestRequestRef.current) return;
      setData(result);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    void loadData(range, selectedInstallId, hideInternal, data === null);
    const interval = setInterval(
      () => void loadData(range, selectedInstallId, hideInternal, false),
      REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [isAuthed, range, selectedInstallId, hideInternal]);

  if (!isAuthed) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-6">
        <h1 className="font-mono text-lg font-semibold text-ink">togetherlink analytics</h1>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await loginToDashboard({ data: password });
              setIsAuthed(true);
            } catch {
              setError("Invalid password");
            }
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-ink"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const dataInstallId = data?.selectedInstallId ?? "all";
  const selectedInstall =
    data && dataInstallId !== "all"
      ? data.installSummaries.find((install) => install.installId === dataInstallId)
      : null;
  const selectedInstallOption =
    dataInstallId === "all"
      ? null
      : data?.installFilterOptions.find((install) => install.installId === dataInstallId);
  const focusedSessions = data?.recentSessions.slice(0, RECENT_SESSIONS_LIMIT) ?? [];
  const focusedDaily = dataInstallId === "all" ? [] : (data?.installDaily ?? []);
  const dataRange = data?.range ?? range;

  return (
    <div className="mx-auto max-w-7xl px-6 pb-32 pt-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-lg font-semibold text-ink">togetherlink analytics</h1>
        <RefreshStatus refreshing={refreshing} lastUpdated={lastUpdated} />
      </header>

      <div className="mb-6 rounded-md border border-line-strong bg-code px-4 py-3 text-sm text-muted">
        Session lifecycle covers Claude, Codex, ChatGPT Desktop, Grok Build, OpenCode, and Pi Code
        when launched through togetherlink. Token and cost totals are available for the proxied
        Claude, Codex, and ChatGPT paths only. Anonymous users are stable install IDs, not
        identified people.
      </div>

      {loading && !data && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <OverviewMetric
              label="Active installs"
              value={formatNumber(data.overview.activeInstalls)}
              period={rangeDescription(dataRange)}
              secondary="Distinct installs with session activity"
            />
            <OverviewMetric
              label="Sessions"
              value={formatNumber(data.overview.sessions)}
              period={rangeDescription(dataRange)}
              secondary="Distinct lifecycle session IDs"
            />
            <OverviewMetric
              label="Repeat installs"
              value={formatNumber(data.overview.repeatInstalls)}
              period={rangeDescription(dataRange)}
              secondary={`${formatPercentage(data.overview.repeatInstalls, data.overview.activeInstalls)} of active installs`}
            />
            <OverviewMetric
              label="Cost coverage"
              value={formatPercentage(data.overview.trackedSessions, data.overview.sessions)}
              period={rangeDescription(dataRange)}
              secondary={`${formatNumber(data.overview.trackedSessions)} tracked · ${formatNumber(data.overview.untrackedSessions)} without cost`}
            />
            <OverviewMetric
              label="Estimated proxy cost"
              value={formatCost(data.overview.usage.costUsd)}
              period={rangeDescription(dataRange)}
            />
          </section>

          <AudienceSummary audience={data.audience} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DailyActiveUsersChart
              rows={data.activeInstallsPerDay}
              activeInstalls={data.overview.activeInstalls}
              range={dataRange}
            />

            <WorldUsageMap
              countries={data.countryLifetime}
              countryCount={data.overview.countries}
              range={dataRange}
              totals={{
                installs: data.overview.activeInstalls,
                sessions: data.overview.sessions,
                tokens: data.overview.usage.promptTokens + data.overview.usage.completionTokens,
                cost: data.overview.usage.costUsd,
              }}
            />

            <UserLeaderboard
              installs={data.installSummaries}
              selectedInstallId={selectedInstallId}
              onSelectInstall={setSelectedInstallId}
              range={dataRange}
            />

            <InstallPicker
              installs={data.installSummaries}
              installOptions={data.installFilterOptions}
              selectedInstallId={selectedInstallId}
              onSelectedInstallIdChange={setSelectedInstallId}
              range={dataRange}
              onNicknameSave={async (installId, nickname) => {
                await saveInstallNickname({ data: { installId, nickname } });
                await loadData(range, selectedInstallId, hideInternal, false);
              }}
            />

            {selectedInstall && (
              <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FocusMetric label="Selected install" value={installDisplayName(selectedInstall)} />
                <FocusMetric label="Sessions ended" value={String(selectedInstall.sessionEnds)} />
                <FocusMetric
                  label={`${rangeLabel(dataRange)} cost`}
                  value={`$${selectedInstall.costUsd.toFixed(4)}`}
                />
                <StatCard
                  title={`Selected sessions ended / ${rangeBucketLabel(dataRange)}`}
                  rows={focusedDaily.map((r) => [
                    formatBucketLabel(r.day, dataRange),
                    r.sessionsEnded,
                  ])}
                />
                <BarCard
                  title={`Selected cost / ${rangeBucketLabel(dataRange)}`}
                  className="md:col-span-2"
                  items={focusedDaily.map((r) => ({
                    label: formatBucketLabel(r.day, dataRange),
                    value: r.costUsd,
                    detail: `${formatTokens(r.promptTokens)} in (${formatTokens(r.cachedTokens)} cached, ${formatCacheHitRatio(r.cachedTokens, r.promptTokens)}) · ${formatTokens(r.completionTokens)} out`,
                    valueLabel: `$${r.costUsd.toFixed(4)}`,
                  }))}
                />
              </div>
            )}

            <RecentSessionsTable
              title={
                selectedInstallOption
                  ? `Recent sessions for ${installDisplayName(selectedInstallOption)}`
                  : "Recent sessions"
              }
              sessions={focusedSessions}
            />

            <ActivitySummary
              range={dataRange}
              activeInstalls={data.overview.activeInstalls}
              installsCompleted={data.overview.installCompletions}
              telemetryInstalls={data.overview.uniqueInstalls}
              sessionsEnded={sumCountRows(data.sessionsEndedPerDay)}
            />

            <BarCard
              title="CLI usage by harness"
              className="md:col-span-2"
              items={data.harnessUsage.map((row) => ({
                label: row.agent,
                value: row.sessions,
                detail: `${formatNumber(row.activeInstalls)} active installs · ${formatNumber(row.repeatInstalls)} repeat · ${formatNumber(row.trackedSessions)} cost tracked · ${formatNumber(row.untrackedSessions)} without cost`,
                valueLabel: `${formatNumber(row.sessions)} sessions`,
              }))}
            />

            <BarCard
              title="Token usage by agent"
              className="md:col-span-2"
              items={data.tokenUsageByAgent.map((r) => ({
                label: r.agent,
                value: r.costUsd,
                detail: `${formatTokens(r.promptTokens)} in (${formatTokens(r.cachedTokens)} cached) · ${formatTokens(r.completionTokens)} out`,
                valueLabel: `$${r.costUsd.toFixed(4)}`,
              }))}
            />

            <BarCard
              title="Token usage by model"
              className="md:col-span-2"
              items={data.tokenUsageByModel.map((r) => ({
                label: r.model,
                value: r.costUsd,
                detail: `${formatTokens(r.promptTokens)} in (${formatTokens(r.cachedTokens)} cached) · ${formatTokens(r.completionTokens)} out`,
                valueLabel: `$${r.costUsd.toFixed(4)}`,
              }))}
            />

            <BarCard
              title="OS distribution"
              items={data.osDistribution.map((r) => ({
                label: r.os,
                value: r.count,
                valueLabel: String(r.count),
              }))}
            />

            <BarCard
              title="CLI version adoption"
              className="md:col-span-2"
              items={data.versionDistribution.map((r) => ({
                label: r.version,
                value: r.count,
                valueLabel: String(r.count),
              }))}
            />

            <div className="md:col-span-2 flex flex-wrap gap-6 rounded-lg border border-line-strong p-4 text-sm">
              <div>
                <div className="text-muted">Failed session rate</div>
                <div className="font-mono text-base text-ink">
                  {(data.failedSessionRate * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-muted">Total events ({rangeLabel(dataRange)})</div>
                <div className="font-mono text-base text-ink">{data.totalEvents}</div>
              </div>
            </div>
          </div>
        </>
      )}

      <DashboardFilterBar
        range={range}
        onRangeChange={setRange}
        hideInternal={hideInternal}
        canHideInternal={hasInternalExclusions}
        onHideInternalChange={(nextValue) => {
          if (nextValue) setSelectedInstallId("all");
          setHideInternal(nextValue);
        }}
        refreshing={refreshing}
      />
    </div>
  );
}

function DashboardFilterBar({
  range,
  onRangeChange,
  hideInternal,
  canHideInternal,
  onHideInternalChange,
  refreshing,
}: {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  hideInternal: boolean;
  canHideInternal: boolean;
  onHideInternalChange: (hideInternal: boolean) => void;
  refreshing: boolean;
}) {
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-2rem)] max-w-max -translate-x-1/2">
      <div
        className="flex flex-wrap items-center justify-center gap-1 rounded-xl bg-white/90 p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl"
        role="group"
        aria-label="Dashboard filters"
        aria-busy={refreshing}
      >
        <span className="hidden pl-2 pr-1 text-xs font-medium text-muted sm:inline">View</span>
        {DASHBOARD_RANGES.map((option) => {
          const isSelected = range === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onRangeChange(option.value)}
              aria-pressed={isSelected}
              className={`min-h-10 rounded-md px-3 text-xs font-medium tabular-nums transition-[background-color,color,box-shadow,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96] sm:px-4 ${
                isSelected
                  ? "bg-ink text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
                  : "text-muted hover:bg-code hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <button
          type="button"
          onClick={() => onHideInternalChange(!hideInternal)}
          aria-pressed={hideInternal}
          disabled={!canHideInternal}
          title={
            canHideInternal ? undefined : "Configure internal install IDs to enable this filter"
          }
          className={`min-h-10 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-[background-color,color,box-shadow,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96] sm:px-4 ${
            hideInternal
              ? "bg-ink text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
              : "text-muted hover:bg-code hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted"
          }`}
        >
          {hideInternal ? "Internal hidden" : "Hide internal"}
        </button>
      </div>
    </div>
  );
}

function FocusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-strong p-4 text-sm">
      <div className="text-muted">{label}</div>
      <div className="mt-1 overflow-hidden text-ellipsis font-mono text-base text-ink">{value}</div>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  period,
  secondary,
}: {
  label: string;
  value: string;
  period: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-lg border border-line-strong bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted">{period}</div>
      {secondary && (
        <div className="mt-3 border-t border-line pt-2 font-mono text-xs tabular-nums text-muted">
          {secondary}
        </div>
      )}
    </div>
  );
}

function AudienceSummary({ audience }: { audience: Audience }) {
  const metrics = [
    { label: "DAU", value: audience.dau, detail: "last 24 hours" },
    { label: "WAU", value: audience.wau, detail: "last 7 days" },
    { label: "MAU", value: audience.mau, detail: "last 30 days" },
    { label: "Lifetime active", value: audience.lifetimeActiveInstalls, detail: "installs" },
    { label: "Lifetime sessions", value: audience.lifetimeSessions, detail: "distinct sessions" },
    {
      label: "Lifetime repeat",
      value: audience.lifetimeRepeatInstalls,
      detail: "installs with 2+ sessions",
    },
  ];

  return (
    <section
      className="mb-4 overflow-hidden rounded-lg border border-line-strong bg-white"
      aria-label="Active audience"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              {metric.label}
            </div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">
              {formatNumber(metric.value)}
            </div>
            <div className="mt-0.5 text-xs text-muted">{metric.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserLeaderboard({
  installs,
  selectedInstallId,
  onSelectInstall,
  range,
}: {
  installs: InstallSummary[];
  selectedInstallId: string;
  onSelectInstall: (installId: string) => void;
  range: DashboardRange;
}) {
  const [metric, setMetric] = useState<LeaderboardMetric>("tokens");
  const rankedInstalls = [...installs]
    .filter((install) => leaderboardMetricValue(install, metric) > 0)
    .sort((a, b) => {
      const metricDifference =
        leaderboardMetricValue(b, metric) - leaderboardMetricValue(a, metric);
      if (metricDifference !== 0) return metricDifference;
      return b.lastSeenAt - a.lastSeenAt;
    })
    .slice(0, 10);
  const maxValue = Math.max(
    1,
    ...rankedInstalls.map((install) => leaderboardMetricValue(install, metric)),
  );

  return (
    <section className="md:col-span-2 overflow-hidden rounded-lg border border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Top 10 users</h2>
          <p className="mt-1 text-xs text-muted">
            Anonymous installs ranked by activity {rangeDescription(range)}.
          </p>
        </div>
        <div className="flex rounded-md bg-code p-1" role="group" aria-label="Leaderboard metric">
          {(["tokens", "sessions"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              aria-pressed={metric === option}
              className={`min-h-10 rounded px-3 text-xs font-medium capitalize transition-[color,background-color,box-shadow,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96] ${
                metric === option ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-line">
        {rankedInstalls.map((install, index) => {
          const value = leaderboardMetricValue(install, metric);
          const isSelected = install.installId === selectedInstallId;

          return (
            <button
              key={install.installId}
              type="button"
              onClick={() => onSelectInstall(install.installId)}
              aria-label={`View analytics for ${install.nickname ?? shortInstallId(install.installId)}`}
              className={`grid min-h-16 w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-[background-color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink active:scale-[0.99] ${
                isSelected ? "bg-code" : "hover:bg-code/60"
              }`}
            >
              <span
                className={`font-mono text-sm tabular-nums ${
                  index < 3 ? "font-semibold text-ink" : "text-faint"
                }`}
              >
                {index + 1}
              </span>

              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`truncate text-sm text-ink ${
                      install.nickname ? "font-medium" : "font-mono"
                    }`}
                  >
                    {install.nickname ?? shortInstallId(install.installId)}
                  </span>
                  <span className="shrink-0 text-xs text-faint">
                    {flagFor(install.countryCode)}
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-ink/80"
                    style={{ width: `${Math.max(2, (value / maxValue) * 100)}%` }}
                  />
                </span>
              </span>

              <span className="text-right">
                <span className="block font-mono text-sm font-medium tabular-nums text-ink">
                  {formatLeaderboardMetric(value, metric)}
                </span>
                <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted">
                  {metric === "tokens"
                    ? `${formatNumber(install.sessionEnds)} ${
                        install.sessionEnds === 1 ? "session" : "sessions"
                      }`
                    : `${formatCompactTokens(totalTokens(install))} tokens`}
                </span>
              </span>
            </button>
          );
        })}

        {rankedInstalls.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-faint">No {metric} data yet</div>
        )}
      </div>

      {metric === "tokens" && (
        <div className="border-t border-line bg-code px-4 py-2.5 text-xs text-muted">
          Token totals cover proxied Claude, Codex, and ChatGPT sessions.
        </div>
      )}
    </section>
  );
}

function DailyActiveUsersChart({
  rows,
  activeInstalls,
  range,
}: {
  rows: DailyActiveUsers[];
  activeInstalls: number;
  range: DashboardRange;
}) {
  const series = fillActivitySeries(rows, range);
  const latest = series.at(-1)?.count ?? 0;
  const peak = Math.max(0, ...series.map((row) => row.count));
  const stickiness = activeInstalls > 0 ? latest / activeInstalls : 0;
  const chartWidth = 720;
  const chartTop = 12;
  const chartBottom = 168;
  const chartHeight = chartBottom - chartTop;
  const chartMax = Math.max(1, peak);
  const points = series.map((row, index) => {
    const x = series.length === 1 ? 0 : (index / (series.length - 1)) * chartWidth;
    const y = chartBottom - (row.count / chartMax) * chartHeight;
    return { ...row, x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points.at(-1)?.x ?? 0} ${chartBottom} L ${points[0]?.x ?? 0} ${chartBottom} Z`
      : "";
  const latestPoint = points.at(-1);

  return (
    <section className="md:col-span-2 overflow-hidden rounded-lg border border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Daily active installs</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            Unique anonymous installs with a deduplicated session lifecycle in each UTC{" "}
            {rangeBucketLabel(range)}. CLI launches without a session are not counted.
          </p>
        </div>
        <span className="rounded-full bg-code px-2.5 py-1 font-mono text-xs text-muted">
          {rangeLabel(range)}
        </span>
      </div>

      <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
        <DauMetric
          label={range === "24h" ? "Current hour" : "Today so far"}
          value={formatNumber(latest)}
        />
        <DauMetric label={`${rangeLabel(range)} active`} value={formatNumber(activeInstalls)} />
        <DauMetric label="Latest / range" value={`${(stickiness * 100).toFixed(1)}%`} />
        <DauMetric label={`${rangeLabel(range)} peak`} value={formatNumber(peak)} />
      </div>

      <div className="p-4">
        <div className="rounded-lg bg-code px-3 pb-2 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-faint">{formatNumber(chartMax)}</span>
            <span className="text-xs text-faint">installs</span>
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} 180`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Active installs ${rangeDescription(range)}, from ${series[0]?.count ?? 0} to ${latest}`}
            className="h-44 w-full overflow-visible"
          >
            <title>Active installs {rangeDescription(range)}</title>
            {[chartTop, chartTop + chartHeight / 2, chartBottom].map((y) => (
              <line
                key={y}
                x1="0"
                x2={chartWidth}
                y1={y}
                y2={y}
                stroke="#dfe3e8"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={areaPath} fill="rgba(10, 10, 10, 0.07)" />
            <path
              d={linePath}
              fill="none"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {latestPoint && (
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="4"
                fill="#0a0a0a"
                stroke="#ffffff"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          <div className="flex justify-between gap-3 font-mono text-xs text-faint">
            <span>{formatChartBucket(series[0]?.day, range)}</span>
            <span>UTC</span>
            <span>Now</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Latest / range compares the current {rangeBucketLabel(range)} with unique active installs{" "}
          {rangeDescription(range)}. The latest value is partial.
        </p>
      </div>
    </section>
  );
}

function DauMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-line px-4 py-3 last:border-r-0 even:border-r-0 sm:even:border-r sm:last:border-r-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

function WorldUsageMap({
  countries,
  countryCount,
  range,
  totals,
}: {
  countries: CountryLifetime[];
  countryCount: number;
  range: DashboardRange;
  totals: Record<MapMetric, number>;
}) {
  const [metric, setMetric] = useState<MapMetric>("installs");
  const values = countries.map((country) => mapMetricValue(country, metric));
  const metricTotal = totals[metric];
  const maxValue = Math.max(1, ...values);
  const mapData = countries
    .filter(
      (country) =>
        WORLD_MAP_COUNTRY_CODES.has(country.countryCode) && mapMetricValue(country, metric) > 0,
    )
    .map((country) => ({
      country: country.countryCode.toLowerCase() as ISOCode,
      value: mapMetricValue(country, metric),
    }));
  const topCountries = [...countries]
    .filter((country) => country.countryCode !== "UNKNOWN" && mapMetricValue(country, metric) > 0)
    .sort((a, b) => mapMetricValue(b, metric) - mapMetricValue(a, metric))
    .slice(0, 8);

  return (
    <section className="md:col-span-2 overflow-hidden rounded-lg border border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Global adoption and usage</h2>
          <p className="mt-1 text-xs text-muted">
            Session-active installs {rangeDescription(range)} across {countryCount} countr
            {countryCount === 1 ? "y" : "ies"}. Active installs are assigned once to their latest
            session country; sessions and usage remain attributed to their telemetry event.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-code p-1">
          {(["installs", "sessions", "tokens", "cost"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              className={`rounded px-2.5 py-1.5 text-xs font-medium capitalize ${
                metric === option ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {mapMetricLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative min-h-[360px] bg-[#fbfcfd] p-4">
          <div className="absolute left-4 top-4 z-10 rounded-md border border-line bg-white/95 px-3 py-2 shadow-sm">
            <div className="text-xs text-muted">{rangeLabel(range)} view</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-ink">
              {formatMapMetric(metricTotal, metric)} {mapMetricLabel(metric)} total
            </div>
          </div>
          <div className="dashboard-world-map flex min-h-[330px] items-center justify-center pt-8">
            <WorldMap
              title={`World map colored by ${rangeLabel(range)} ${mapMetricLabel(metric)}`}
              data={mapData}
              size="responsive"
              color="#1d4ed8"
              backgroundColor="#fbfcfd"
              borderColor="#ffffff"
              strokeOpacity={1}
              styleFunction={(context) => ({
                fill: mapFill(
                  typeof context.countryValue === "number" ? context.countryValue : 0,
                  maxValue,
                ),
                stroke: "#ffffff",
                strokeWidth: 0.6,
                cursor: "default",
              })}
              tooltipTextFunction={(context) =>
                `${context.countryName}: ${formatMapMetric(
                  typeof context.countryValue === "number" ? context.countryValue : 0,
                  metric,
                )} ${mapMetricLabel(metric)}`
              }
            />
          </div>
          <div className="absolute bottom-3 right-4 text-[10px] text-faint">
            Map:{" "}
            <a
              href="https://www.npmjs.com/package/react-svg-worldmap"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              react-svg-worldmap
            </a>
          </div>
        </div>

        <div className="border-t border-line bg-white p-4 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-faint">
              Top countries
            </h3>
            <span className="text-xs text-muted">
              Top {topCountries.length} of {countryCount}
            </span>
          </div>
          <div className="flex flex-col">
            {topCountries.map((country, index) => (
              <div
                key={country.countryCode}
                className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line py-2.5 last:border-b-0"
              >
                <span className="font-mono text-xs text-faint">{index + 1}</span>
                <span className="truncate text-sm text-ink">
                  {flagFor(country.countryCode)} {countryName(country.countryCode)}
                </span>
                <span className="font-mono text-sm text-muted">
                  {formatMapMetric(mapMetricValue(country, metric), metric)}
                </span>
              </div>
            ))}
            {topCountries.length === 0 && (
              <div className="py-4 text-sm text-faint">No data yet</div>
            )}
          </div>
          <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Global {mapMetricLabel(metric)} total: {formatMapMetric(metricTotal, metric)}. The list
            above shows only the highest-usage countries.
          </div>
        </div>
      </div>
    </section>
  );
}

function InstallPicker({
  installs,
  installOptions,
  selectedInstallId,
  onSelectedInstallIdChange,
  onNicknameSave,
  range,
}: {
  installs: InstallSummary[];
  installOptions: InstallFilterOption[];
  selectedInstallId: string;
  onSelectedInstallIdChange: (installId: string) => void;
  onNicknameSave: (installId: string, nickname: string) => Promise<void>;
  range: DashboardRange;
}) {
  const [editingInstall, setEditingInstall] = useState<InstallSummary | null>(null);

  return (
    <section className="md:col-span-2 rounded-lg border border-line-strong p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">People / installs</h2>
          <p className="mt-1 text-xs text-muted">
            {installs.length} anonymous install{installs.length === 1 ? "" : "s"} seen{" "}
            {rangeDescription(range)}.
          </p>
        </div>
        <select
          value={selectedInstallId}
          onChange={(event) => onSelectedInstallIdChange(event.target.value)}
          className="min-w-56 rounded-md border border-line-strong bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-ink"
        >
          <option value="all">All installs</option>
          {installOptions.map((install) => (
            <option key={install.installId} value={install.installId}>
              {installDisplayName(install)} · last seen {formatDateTime(install.lastSeenAt)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-faint">
              <th className="border-b border-line py-2 font-medium">Person / install</th>
              <th className="border-b border-line py-2 font-medium">Last seen</th>
              <th className="border-b border-line py-2 font-medium">Sessions</th>
              <th className="border-b border-line py-2 font-medium">Cost</th>
              <th className="border-b border-line py-2 font-medium">Agent</th>
              <th className="border-b border-line py-2 font-medium">OS</th>
              <th className="border-b border-line py-2 font-medium">Country</th>
            </tr>
          </thead>
          <tbody>
            {installs.slice(0, 12).map((install) => (
              <tr
                key={install.installId}
                className={selectedInstallId === install.installId ? "bg-code" : undefined}
              >
                <td className="border-b border-line py-2 pr-4">
                  <PersonInstallCell
                    install={install}
                    onSelect={() => onSelectedInstallIdChange(install.installId)}
                    onEdit={() => setEditingInstall(install)}
                  />
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-muted">
                  {formatDateTime(install.lastSeenAt)}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-ink">
                  {install.sessionEnds}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-ink">
                  ${install.costUsd.toFixed(4)}
                </td>
                <td className="border-b border-line py-2 pr-4 text-muted">
                  {install.agents.join(", ") || "unknown"}
                </td>
                <td className="border-b border-line py-2 pr-4 text-muted">{install.os}</td>
                <td className="border-b border-line py-2 text-muted">
                  {flagFor(install.countryCode)} {install.countryCode}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingInstall && (
        <EditInstallNameDialog
          install={editingInstall}
          onClose={() => setEditingInstall(null)}
          onSave={async (nickname) => {
            await onNicknameSave(editingInstall.installId, nickname);
            setEditingInstall(null);
          }}
        />
      )}
    </section>
  );
}

function PersonInstallCell({
  install,
  onSelect,
  onEdit,
}: {
  install: InstallSummary;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-w-56 items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left active:scale-[0.96]"
        title={install.installId}
      >
        <span
          className={`block truncate text-sm text-ink ${install.nickname ? "font-medium" : "font-mono"}`}
        >
          {install.nickname ?? shortInstallId(install.installId)}
        </span>
        {install.nickname && (
          <span className="mt-0.5 block truncate font-mono text-xs text-muted">
            {shortInstallId(install.installId)}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit name for ${install.nickname ?? shortInstallId(install.installId)}`}
        title="Edit name"
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-faint transition-[color,background-color,scale] duration-150 ease-out hover:bg-code hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96]"
      >
        <PencilIcon />
      </button>
    </div>
  );
}

function EditInstallNameDialog({
  install,
  onClose,
  onSave,
}: {
  install: InstallSummary;
  onClose: () => void;
  onSave: (nickname: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [nickname, setNickname] = useState(install.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const hasChanges = nickname.trim() !== (install.nickname ?? "");

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl bg-transparent p-0 backdrop:bg-black/25 backdrop:backdrop-blur-[1px]"
    >
      <form
        className="rounded-xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.16)]"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError(null);
          try {
            await onSave(nickname);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <h3 className="text-base font-semibold text-ink">Edit person name</h3>
          <p className="mt-1 text-sm text-muted">
            Add a recognizable name for this anonymous install.
          </p>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Name</span>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Customer or person name"
            className="w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-ink focus:shadow-[0_0_0_3px_rgba(0,0,0,0.08)]"
            autoFocus
          />
        </label>

        <div className="mt-2 font-mono text-xs text-faint" title={install.installId}>
          Install {shortInstallId(install.installId)}
        </div>
        <p className="mt-1 text-xs text-muted">Leave the name blank to show the install ID.</p>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-10 rounded-lg px-3.5 text-sm font-medium text-muted transition-[background-color,color,scale] duration-150 hover:bg-code hover:text-ink active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="size-4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.25 13.75 3.5 16.5l2.75-.75L14.7 7.3a1.75 1.75 0 0 0 0-2.48l-.52-.52a1.75 1.75 0 0 0-2.48 0L4.25 13.75Z" />
      <path d="m10.75 5.25 4 4" />
    </svg>
  );
}

function RecentSessionsTable({ title, sessions }: { title: string; sessions: RecentSession[] }) {
  return (
    <section className="md:col-span-2 rounded-lg border border-line-strong p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <span className="font-mono text-xs text-muted">{sessions.length} shown</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-faint">
              <th className="border-b border-line py-2 font-medium">When</th>
              <th className="border-b border-line py-2 font-medium">Install</th>
              <th className="border-b border-line py-2 font-medium">Agent</th>
              <th className="border-b border-line py-2 font-medium">Model</th>
              <th className="border-b border-line py-2 font-medium">Duration</th>
              <th className="border-b border-line py-2 font-medium">Tokens</th>
              <th className="border-b border-line py-2 font-medium">Cost</th>
              <th className="border-b border-line py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.sessionId}>
                <td className="border-b border-line py-2 pr-4 font-mono text-muted">
                  {formatDateTime(session.endedAt ?? session.startedAt ?? session.lastEventAt)}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-ink">
                  {session.installNickname ?? shortInstallId(session.installId)}
                </td>
                <td className="border-b border-line py-2 pr-4 text-muted">{session.agent}</td>
                <td className="max-w-[220px] truncate border-b border-line py-2 pr-4 font-mono text-muted">
                  {session.model}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-muted">
                  {formatDuration(session.durationMs)}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-muted">
                  {session.usageTracked
                    ? formatTokens(session.promptTokens + session.completionTokens)
                    : "not tracked"}
                </td>
                <td className="border-b border-line py-2 pr-4 font-mono text-ink">
                  {session.usageTracked ? formatCost(session.costUsd) : "not tracked"}
                </td>
                <td className="border-b border-line py-2 font-mono text-muted">
                  {session.status}
                  {session.exitCode !== undefined && session.exitCode !== 0
                    ? ` (${session.exitCode})`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <div className="py-4 text-sm text-faint">No sessions yet</div>}
      </div>
    </section>
  );
}

function RefreshStatus({
  refreshing,
  lastUpdated,
}: {
  refreshing: boolean;
  lastUpdated: number | null;
}) {
  const [, setTick] = useState(0);
  // Re-render once a second so the "Xs ago" text stays current without
  // needing its own data refresh.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))
    : null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span
        className={`inline-block h-2 w-2 rounded-full ${refreshing ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      <span>
        {refreshing
          ? "Refreshing…"
          : secondsAgo !== null
            ? `Updated ${secondsAgo}s ago`
            : "Loading…"}{" "}
        · auto-refreshes every {REFRESH_INTERVAL_MS / 1000}s
      </span>
    </div>
  );
}

function ActivitySummary({
  range,
  activeInstalls,
  installsCompleted,
  telemetryInstalls,
  sessionsEnded,
}: {
  range: DashboardRange;
  activeInstalls: number;
  installsCompleted: number;
  telemetryInstalls: number;
  sessionsEnded: number;
}) {
  const metrics = [
    { label: "Active install IDs", value: activeInstalls },
    { label: "All telemetry IDs", value: telemetryInstalls },
    { label: "Install-completion IDs", value: installsCompleted },
    { label: "Sessions ended", value: sessionsEnded },
  ];

  return (
    <section
      className="md:col-span-2 overflow-hidden rounded-lg border border-line-strong"
      aria-label="Activity totals"
    >
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="px-4 py-3">
            <div className="text-xs font-medium text-muted">{metric.label}</div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="font-mono text-lg font-semibold tabular-nums text-ink">
                {formatNumber(metric.value)}
              </span>
              <span className="text-xs text-faint">{rangeLabel(range)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-line bg-code px-4 py-2.5 text-xs text-muted">
        Active install IDs are the adoption measure used by the headline and map. All telemetry IDs
        also include CLI-only events; install-completion IDs only cover successful installer
        callbacks.
      </p>
    </section>
  );
}

function StatCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="rounded-lg border border-line-strong p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <span className="font-mono text-sm text-muted">total {total}</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map(([day, count]) => (
          <div key={day} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-mono text-muted">{day}</span>
            <span className="font-mono text-ink">{count}</span>
          </div>
        ))}
        {rows.length === 0 && <span className="text-sm text-faint">No data yet</span>}
      </div>
    </div>
  );
}

function BarCard({
  title,
  items,
  className,
}: {
  title: string;
  items: Array<{ label: string; value: number; detail?: string; valueLabel: string }>;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={`rounded-lg border border-line-strong p-4 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-medium text-ink">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-mono text-ink">{item.label}</span>
              <span className="font-mono text-muted">{item.valueLabel}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-ink/80"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
            {item.detail && <div className="mt-1 text-xs text-faint">{item.detail}</div>}
          </div>
        ))}
        {items.length === 0 && <span className="text-sm text-faint">No data yet</span>}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatPercentage(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function sumCountRows(rows: Array<{ count: number }>): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function totalTokens(usage: { promptTokens: number; completionTokens: number }): number {
  return usage.promptTokens + usage.completionTokens;
}

function leaderboardMetricValue(
  install: Pick<InstallSummary, "promptTokens" | "completionTokens" | "sessionEnds">,
  metric: LeaderboardMetric,
): number {
  return metric === "tokens" ? totalTokens(install) : install.sessionEnds;
}

function formatLeaderboardMetric(value: number, metric: LeaderboardMetric): string {
  return metric === "tokens" ? formatCompactTokens(value) : formatNumber(value);
}

function fillActivitySeries(rows: DailyActiveUsers[], range: DashboardRange): DailyActiveUsers[] {
  const countByBucket = new Map(rows.map((row) => [row.day, row.count]));
  const now = new Date();
  const intervalMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const currentBucket =
    range === "24h"
      ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const defaultBucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const firstLifetimeBucket =
    range === "lifetime" && rows[0]
      ? Date.parse(`${rows[0].day.slice(0, 10)}T00:00:00Z`)
      : currentBucket - (defaultBucketCount - 1) * intervalMs;
  const bucketCount =
    range === "lifetime"
      ? Math.max(1, Math.floor((currentBucket - firstLifetimeBucket) / intervalMs) + 1)
      : defaultBucketCount;

  return Array.from({ length: bucketCount }, (_, index) => {
    const timestamp = currentBucket - (bucketCount - index - 1) * intervalMs;
    const iso = new Date(timestamp).toISOString();
    const day = range === "24h" ? `${iso.slice(0, 13)}:00` : iso.slice(0, 10);
    return { day, count: countByBucket.get(day) ?? 0 };
  });
}

function formatChartBucket(bucket: string | undefined, range: DashboardRange): string {
  if (!bucket) return "-";
  const date = new Date(range === "24h" ? `${bucket}:00Z` : `${bucket}T00:00:00Z`);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(range === "24h" ? { hour: "numeric", hour12: true } : {}),
    timeZone: "UTC",
  });
}

function formatBucketLabel(bucket: string, range: DashboardRange): string {
  return formatChartBucket(bucket, range);
}

function rangeLabel(range: DashboardRange): string {
  return DASHBOARD_RANGES.find((option) => option.value === range)?.label ?? range;
}

function rangeDescription(range: DashboardRange): string {
  switch (range) {
    case "24h":
      return "in the last 24 hours";
    case "7d":
      return "in the last 7 days";
    case "30d":
      return "in the last 30 days";
    case "lifetime":
      return "across all time";
  }
}

function rangeBucketLabel(range: DashboardRange): string {
  return range === "24h" ? "hour" : "day";
}

function formatCompactTokens(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatCost(costUsd: number): string {
  if (costUsd >= 100) return `$${costUsd.toFixed(0)}`;
  if (costUsd >= 1) return `$${costUsd.toFixed(2)}`;
  return `$${costUsd.toFixed(4)}`;
}

function mapMetricValue(country: CountryLifetime, metric: MapMetric): number {
  switch (metric) {
    case "installs":
      return country.activeInstalls;
    case "sessions":
      return country.sessionsStarted;
    case "tokens":
      return country.promptTokens + country.completionTokens;
    case "cost":
      return country.costUsd;
  }
}

function mapMetricLabel(metric: MapMetric): string {
  return metric === "installs" ? "active installs" : metric;
}

function formatMapMetric(value: number, metric: MapMetric): string {
  switch (metric) {
    case "tokens":
      return formatCompactTokens(value);
    case "cost":
      return formatCost(value);
    default:
      return formatNumber(value);
  }
}

function mapFill(value: number, maxValue: number): string {
  if (value <= 0) return "#e9edf1";
  const intensity = Math.max(0.18, Math.log1p(value) / Math.log1p(maxValue));
  const lightness = 88 - intensity * 58;
  return `hsl(221 72% ${lightness}%)`;
}

function countryName(countryCode: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase()) ?? countryCode
    );
  } catch {
    return countryCode;
  }
}

function formatCacheHitRatio(cachedTokens: number, promptTokens: number): string {
  if (promptTokens <= 0) return "0.0% hit";
  const ratio = Math.max(0, Math.min(1, cachedTokens / promptTokens));
  return `${(ratio * 100).toFixed(1)}% hit`;
}

function formatDateTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return "-";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function shortInstallId(installId: string): string {
  return installId.length <= 12 ? installId : `${installId.slice(0, 8)}...${installId.slice(-4)}`;
}

function installDisplayName(install: Pick<InstallSummary, "installId" | "nickname">): string {
  return install.nickname
    ? `${install.nickname} (${shortInstallId(install.installId)})`
    : shortInstallId(install.installId);
}

// Renders an ISO 3166-1 alpha-2 country code as its flag emoji via regional
// indicator symbols. Falls back to a globe for codes we can't map (e.g. "unknown").
function flagFor(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) {
    return "🌐";
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
