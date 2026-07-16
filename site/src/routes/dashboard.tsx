import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import worldMap from "@svg-maps/world";
import { ConvexHttpClient } from "convex/browser";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

type DashboardSummary = Awaited<ReturnType<typeof fetchSummary>>;
type DashboardData = NonNullable<DashboardSummary>;
type InstallSummary = DashboardData["installSummaries"][number];
type RecentSession = DashboardData["recentSessions"][number];
type CountryLifetime = DashboardData["countryLifetime"][number];
type MapMetric = "installs" | "sessions" | "tokens" | "cost";

const WORLD_MAP = worldMap as {
  viewBox: string;
  locations: Array<{ id: string; name: string; path: string }>;
};
const REFRESH_INTERVAL_MS = 15_000;
const RECENT_SESSIONS_LIMIT = 10;

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

async function fetchSummary() {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!url) {
    return null;
  }
  const client = new ConvexHttpClient(url);
  return client.query(api.analytics.getDashboardSummary, { days: 30 });
}

const checkDashboardAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = await dashboardSession();
  return { authed: Boolean(session.data.authed) };
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

const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await dashboardSession();
  if (!session.data.authed) {
    throw new Error("Not authorized");
  }
  return fetchSummary();
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
  loader: async () => checkDashboardAuth(),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { authed } = Route.useLoaderData();
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

  const loadData = async (isFirstLoad: boolean) => {
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const result = await getDashboardData();
      setData(result);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    const interval = setInterval(() => void loadData(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthed]);

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
              await loadData(true);
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

  if (!data && !loading) {
    void loadData(true);
  }

  const selectedInstall =
    data && selectedInstallId !== "all"
      ? data.installSummaries.find((install) => install.installId === selectedInstallId)
      : null;
  const focusedSessions =
    data?.recentSessions
      .filter((session) => selectedInstallId === "all" || session.installId === selectedInstallId)
      .slice(0, RECENT_SESSIONS_LIMIT) ?? [];
  const focusedDaily =
    data?.installDaily.filter(
      (day) => selectedInstallId !== "all" && day.installId === selectedInstallId,
    ) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
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
              label="Install completions"
              value={formatNumber(data.overview.installs24h)}
              period="last 24 hours"
              lifetime={`${formatNumber(data.overview.installsLifetime)} lifetime`}
            />
            <OverviewMetric
              label="Anonymous users"
              value={formatNumber(data.overview.activeInstalls24h)}
              period="active last 24 hours"
              lifetime={`${formatNumber(data.overview.uniqueInstallsLifetime)} ever seen`}
            />
            <OverviewMetric
              label="Sessions started"
              value={formatNumber(data.overview.sessions24h)}
              period="last 24 hours"
              lifetime={`${formatNumber(data.overview.sessionsLifetime)} lifetime`}
            />
            <OverviewMetric
              label="Token usage"
              value={formatCompactTokens(totalTokens(data.overview.usage24h))}
              period="last 24 hours"
              lifetime={`${formatCompactTokens(totalTokens(data.overview.usageLifetime))} lifetime`}
            />
            <OverviewMetric
              label="Total cost"
              value={formatCost(data.overview.usage24h.costUsd)}
              period="last 24 hours"
              lifetime={`${formatCost(data.overview.usageLifetime.costUsd)} lifetime`}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <WorldUsageMap
              countries={data.countryLifetime}
              countryCount={data.overview.countriesLifetime}
            />

            <InstallPicker
              installs={data.installSummaries}
              selectedInstallId={selectedInstallId}
              onSelectedInstallIdChange={setSelectedInstallId}
              onNicknameSave={async (installId, nickname) => {
                await saveInstallNickname({ data: { installId, nickname } });
                await loadData(false);
              }}
            />

            {selectedInstall && (
              <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FocusMetric label="Selected install" value={installDisplayName(selectedInstall)} />
                <FocusMetric label="Sessions ended" value={String(selectedInstall.sessionEnds)} />
                <FocusMetric label="30d cost" value={`$${selectedInstall.costUsd.toFixed(4)}`} />
                <StatCard
                  title="Selected sessions ended / day"
                  rows={focusedDaily.map((r) => [r.day, r.sessionsEnded])}
                />
                <BarCard
                  title="Selected cost / day"
                  className="md:col-span-2"
                  items={focusedDaily.map((r) => ({
                    label: r.day,
                    value: r.costUsd,
                    detail: `${formatTokens(r.promptTokens)} in (${formatTokens(r.cachedTokens)} cached, ${formatCacheHitRatio(r.cachedTokens, r.promptTokens)}) · ${formatTokens(r.completionTokens)} out`,
                    valueLabel: `$${r.costUsd.toFixed(4)}`,
                  }))}
                />
              </div>
            )}

            <RecentSessionsTable
              title={
                selectedInstall
                  ? `Recent sessions for ${installDisplayName(selectedInstall)}`
                  : "Recent sessions"
              }
              sessions={focusedSessions}
            />

            <StatCard
              title="Active installs / day"
              rows={data.activeInstallsPerDay.map((r) => [r.day, r.count])}
            />
            <StatCard
              title="Installs completed / day"
              rows={data.installsPerDay.map((r) => [r.day, r.count])}
            />
            <StatCard
              title="Sessions started / day"
              rows={data.sessionsStartedPerDay.map((r) => [r.day, r.count])}
            />
            <StatCard
              title="Sessions ended / day"
              rows={data.sessionsEndedPerDay.map((r) => [r.day, r.count])}
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
                <div className="text-muted">Total events (30d)</div>
                <div className="font-mono text-base text-ink">{data.totalEvents}</div>
              </div>
            </div>
          </div>
        </>
      )}
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
  lifetime,
}: {
  label: string;
  value: string;
  period: string;
  lifetime: string;
}) {
  return (
    <div className="rounded-lg border border-line-strong bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{period}</div>
      <div className="mt-3 border-t border-line pt-2 font-mono text-xs text-muted">{lifetime}</div>
    </div>
  );
}

function WorldUsageMap({
  countries,
  countryCount,
}: {
  countries: CountryLifetime[];
  countryCount: number;
}) {
  const [metric, setMetric] = useState<MapMetric>("installs");
  const [hoveredCountryCode, setHoveredCountryCode] = useState<string | null>(null);
  const countriesByCode = new Map(
    countries.map((country) => [country.countryCode.toLowerCase(), country]),
  );
  const values = countries.map((country) => mapMetricValue(country, metric));
  const maxValue = Math.max(1, ...values);
  const hoveredCountry = hoveredCountryCode
    ? countriesByCode.get(hoveredCountryCode.toLowerCase())
    : undefined;
  const hoveredLocation = hoveredCountryCode
    ? WORLD_MAP.locations.find((location) => location.id === hoveredCountryCode.toLowerCase())
    : undefined;
  const topCountries = [...countries]
    .filter((country) => country.countryCode !== "UNKNOWN")
    .sort((a, b) => mapMetricValue(b, metric) - mapMetricValue(a, metric))
    .slice(0, 8);

  return (
    <section className="md:col-span-2 overflow-hidden rounded-lg border border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Global adoption and usage</h2>
          <p className="mt-1 text-xs text-muted">
            Lifetime activity across {countryCount} countr{countryCount === 1 ? "y" : "ies"}.
            Country is resolved when each telemetry event reaches Vercel.
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
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative min-h-[360px] bg-[#fbfcfd] p-4">
          <div className="absolute left-4 top-4 z-10 rounded-md border border-line bg-white/95 px-3 py-2 shadow-sm">
            <div className="text-xs text-muted">{hoveredLocation?.name ?? "Hover a country"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-ink">
              {hoveredCountry
                ? formatMapMetric(mapMetricValue(hoveredCountry, metric), metric)
                : `Showing ${metric}`}
            </div>
          </div>
          <svg
            viewBox={WORLD_MAP.viewBox}
            role="img"
            aria-label={`World map colored by lifetime ${metric}`}
            className="h-full min-h-[330px] w-full"
          >
            {WORLD_MAP.locations.map((location) => {
              const country = countriesByCode.get(location.id);
              const value = country ? mapMetricValue(country, metric) : 0;
              return (
                <path
                  key={location.id}
                  d={location.path}
                  fill={mapFill(value, maxValue)}
                  stroke="#ffffff"
                  strokeWidth={0.55}
                  className="cursor-default transition-opacity hover:opacity-75"
                  onMouseEnter={() => setHoveredCountryCode(location.id)}
                  onMouseLeave={() => setHoveredCountryCode(null)}
                >
                  <title>
                    {location.name}: {formatMapMetric(value, metric)}
                  </title>
                </path>
              );
            })}
          </svg>
          <div className="absolute bottom-3 right-4 text-[10px] text-faint">
            Map geometry:{" "}
            <a
              href="https://www.npmjs.com/package/@svg-maps/world"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              @svg-maps/world
            </a>{" "}
            (CC BY 4.0)
          </div>
        </div>

        <div className="border-t border-line bg-white p-4 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-faint">
              Top countries
            </h3>
            <span className="text-xs capitalize text-muted">{metric}</span>
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
        </div>
      </div>
    </section>
  );
}

function InstallPicker({
  installs,
  selectedInstallId,
  onSelectedInstallIdChange,
  onNicknameSave,
}: {
  installs: InstallSummary[];
  selectedInstallId: string;
  onSelectedInstallIdChange: (installId: string) => void;
  onNicknameSave: (installId: string, nickname: string) => Promise<void>;
}) {
  return (
    <section className="md:col-span-2 rounded-lg border border-line-strong p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">People / installs</h2>
          <p className="mt-1 text-xs text-muted">
            {installs.length} anonymous install{installs.length === 1 ? "" : "s"} active in the last
            30 days.
          </p>
        </div>
        <select
          value={selectedInstallId}
          onChange={(event) => onSelectedInstallIdChange(event.target.value)}
          className="min-w-56 rounded-md border border-line-strong bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-ink"
        >
          <option value="all">All installs</option>
          {installs.map((install) => (
            <option key={install.installId} value={install.installId}>
              {installDisplayName(install)} · {install.sessionEnds} sessions ·{" "}
              {formatDateTime(install.lastSeenAt)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-faint">
              <th className="border-b border-line py-2 font-medium">Name</th>
              <th className="border-b border-line py-2 font-medium">Install</th>
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
                  <NicknameField install={install} onSave={onNicknameSave} />
                </td>
                <td className="border-b border-line py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => onSelectedInstallIdChange(install.installId)}
                    className="font-mono text-ink underline-offset-2 hover:underline"
                  >
                    {shortInstallId(install.installId)}
                  </button>
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
    </section>
  );
}

function NicknameField({
  install,
  onSave,
}: {
  install: InstallSummary;
  onSave: (installId: string, nickname: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(install.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(install.nickname ?? "");
  }, [install.installId, install.nickname]);

  const hasChanges = nickname.trim() !== (install.nickname ?? "");

  return (
    <form
      className="flex min-w-64 items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await onSave(install.installId, nickname);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Add name"
          className="w-full rounded-md border border-line-strong bg-white px-2 py-1 font-mono text-sm text-ink outline-none focus:border-ink"
        />
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
      <button
        type="submit"
        disabled={saving || !hasChanges}
        className="rounded-md border border-line-strong px-2 py-1 text-xs font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving" : "Save"}
      </button>
    </form>
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

function totalTokens(usage: { promptTokens: number; completionTokens: number }): number {
  return usage.promptTokens + usage.completionTokens;
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
      return country.installCompletions;
    case "sessions":
      return country.sessionsStarted;
    case "tokens":
      return country.promptTokens + country.completionTokens;
    case "cost":
      return country.costUsd;
  }
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
