import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { ConvexHttpClient } from "convex/browser";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { parseInstallIdList } from "../../convex/dashboardFilters";

type CliUsageRange = "24h" | "7d";
type CliUsageFilters = {
  range: CliUsageRange;
  latestVersion: string;
  hideInternal?: boolean;
};

const REFRESH_INTERVAL_MS = 15_000;
const PIE_COLORS = ["#0a0a0a", "#2563eb", "#0f9f6e", "#d97706", "#7c3aed", "#db2777", "#64748b"];
const ADOPTION_COLORS = {
  latest: "#0f9f6e",
  newer: "#2563eb",
  outdated: "#d97706",
  unknown: "#94a3b8",
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

function configuredInternalInstallIds(): string[] {
  return parseInstallIdList(
    process.env.DASHBOARD_ADMIN_INSTALL_ID,
    process.env.DASHBOARD_INTERNAL_INSTALL_IDS,
  );
}

async function fetchCliUsageSummary(filters: CliUsageFilters) {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!url) return null;
  const { hideInternal, ...queryFilters } = filters;
  const internalInstallIds = configuredInternalInstallIds();
  if (hideInternal && internalInstallIds.length === 0) {
    throw new Error("Internal user IDs are not configured");
  }
  const client = new ConvexHttpClient(url);
  return client.query(api.analytics.getCliUsageSummary, {
    ...queryFilters,
    ...(hideInternal ? { excludedInstallIds: internalInstallIds } : {}),
  });
}

type CliUsageSummary = Awaited<ReturnType<typeof fetchCliUsageSummary>>;
type CliUsageData = NonNullable<CliUsageSummary>;

const checkCliUsageAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = await dashboardSession();
  return {
    authed: Boolean(session.data.authed),
    hasInternalExclusions: configuredInternalInstallIds().length > 0,
  };
});

const loginToCliUsage = createServerFn({ method: "POST" })
  .validator((password: string) => password)
  .handler(async ({ data: password }) => {
    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected || password !== expected) throw new Error("Invalid password");
    const session = await dashboardSession();
    await session.update({ authed: true });
    return { ok: true };
  });

const getCliUsageData = createServerFn({ method: "GET" })
  .validator((filters: CliUsageFilters) => filters)
  .handler(async ({ data: filters }) => {
    const session = await dashboardSession();
    if (!session.data.authed) throw new Error("Not authorized");
    return fetchCliUsageSummary(filters);
  });

export const Route = createFileRoute("/dashboard_/cli-usage")({
  head: () => ({
    meta: [
      { title: "CLI adoption · togetherlink analytics" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async () => checkCliUsageAuth(),
  component: CliUsageRoute,
});

function CliUsageRoute() {
  const { authed, hasInternalExclusions } = Route.useLoaderData();
  const [isAuthed, setIsAuthed] = useState(authed);
  const [password, setPassword] = useState("");
  const [range, setRange] = useState<CliUsageRange>("24h");
  const [hideInternal, setHideInternal] = useState(hasInternalExclusions);
  const [data, setData] = useState<CliUsageSummary>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const loadData = async (
    requestedRange: CliUsageRange,
    shouldHideInternal: boolean,
    isFirstLoad: boolean,
  ) => {
    const requestId = ++latestRequestRef.current;
    if (isFirstLoad) setLoading(true);
    else setRefreshing(true);
    try {
      const releaseResponse = await fetch("/latest.json", { cache: "no-store" });
      if (!releaseResponse.ok) throw new Error("Could not load the current CLI release");
      const release = (await releaseResponse.json()) as { version?: unknown };
      if (typeof release.version !== "string") throw new Error("Invalid CLI release manifest");
      const result = await getCliUsageData({
        data: {
          range: requestedRange,
          latestVersion: release.version,
          ...(shouldHideInternal ? { hideInternal: true } : {}),
        },
      });
      if (requestId !== latestRequestRef.current) return;
      setData(result);
      setLastUpdated(Date.now());
      setError(null);
    } catch (loadError) {
      if (requestId !== latestRequestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    void loadData(range, hideInternal, data === null);
    const interval = setInterval(
      () => void loadData(range, hideInternal, false),
      REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [isAuthed, range, hideInternal]);

  if (!isAuthed) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-6">
        <h1 className="text-balance font-mono text-lg font-semibold text-ink">
          togetherlink analytics
        </h1>
        <p className="mt-2 text-pretty text-sm text-muted">Sign in to view CLI adoption data.</p>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            try {
              await loginToCliUsage({ data: password });
              setIsAuthed(true);
            } catch {
              setError("Invalid password");
            }
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="min-h-10 rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-ink"
            autoFocus
          />
          <button
            type="submit"
            className="min-h-10 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition-[opacity,scale] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
          >
            Sign in
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 pb-28 pt-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex min-h-10 items-center text-xs font-medium text-muted transition-[color,scale] duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96]"
          >
            ← Analytics overview
          </Link>
          <h1 className="mt-2 text-balance font-mono text-2xl font-semibold tracking-tight text-ink">
            CLI adoption
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted">
            See which releases people run, which coding agents they launch, and which models their
            sessions report.
          </p>
        </div>
        <RefreshStatus refreshing={refreshing} lastUpdated={lastUpdated} />
      </header>

      <FilterBar
        range={range}
        onRangeChange={setRange}
        hideInternal={hideInternal}
        canHideInternal={hasInternalExclusions}
        onHideInternalChange={setHideInternal}
      />

      {loading && !data && <p className="mt-8 text-sm text-muted">Loading adoption data…</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {data && <CliUsageContent data={data} />}
    </main>
  );
}

function CliUsageContent({ data }: { data: CliUsageData }) {
  const adoptionTotal = data.uniqueUsers;
  const latestShare = adoptionTotal === 0 ? 0 : data.adoption.latest / adoptionTotal;
  const modelCoverage = data.modelSessions === 0 ? 0 : data.knownModelSessions / data.modelSessions;
  const adoptionItems = [
    { label: "Latest", value: data.adoption.latest, color: ADOPTION_COLORS.latest },
    { label: "Newer build", value: data.adoption.newer, color: ADOPTION_COLORS.newer },
    { label: "Outdated", value: data.adoption.outdated, color: ADOPTION_COLORS.outdated },
    { label: "Unknown", value: data.adoption.unknown, color: ADOPTION_COLORS.unknown },
  ];
  const harnessItems = data.harnessUsage.map((row, index) => ({
    label: row.agent,
    value: row.launches,
    detail: `${formatNumber(row.users)} ${plural(row.users, "user")}`,
    color: PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0],
  }));
  const modelItems = compactPieItems(
    data.modelUsage.map((row, index) => ({
      label: row.model,
      value: row.sessions,
      detail: `${formatNumber(row.users)} ${plural(row.users, "user")}`,
      color: PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0],
    })),
  );

  return (
    <>
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="CLI launches"
          value={formatNumber(data.totalLaunches)}
          detail={rangeLabel(data.range)}
        />
        <MetricCard
          label="Active CLI users"
          value={formatNumber(data.uniqueUsers)}
          detail="Distinct installs that launched the CLI"
        />
        <MetricCard
          label="On latest release"
          value={formatPercent(latestShare)}
          detail={`v${data.latestVersion} · ${formatNumber(data.adoption.latest)} users`}
        />
        <MetricCard
          label="Model coverage"
          value={formatPercent(modelCoverage)}
          detail={`${formatNumber(data.knownModelSessions)} of ${formatNumber(data.modelSessions)} sessions reported a model`}
        />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PieCard
          title="Release adoption"
          subtitle="Users by most recent CLI version"
          items={adoptionItems}
          centerLabel="users"
        />
        <PieCard
          title="Harness share"
          subtitle="All cli_started launches"
          items={harnessItems}
          centerLabel="launches"
        />
        <PieCard
          title="Model share"
          subtitle="Distinct sessions by reported launch model"
          items={modelItems}
          centerLabel="sessions"
        />
      </section>

      <section className="mt-4 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_-1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-balance text-sm font-semibold text-ink">Version breakdown</h2>
            <p className="mt-1 text-pretty text-xs text-muted">
              Users are assigned to their most recent version; launches count every cli_started
              event.
            </p>
          </div>
          <span className="font-mono text-xs text-muted">latest v{data.latestVersion}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-code text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Users</th>
                <th className="px-5 py-3 text-right font-medium">Launches</th>
              </tr>
            </thead>
            <tbody>
              {data.versionUsage.map((row) => (
                <tr key={row.version} className="border-t border-line first:border-t-0">
                  <td className="px-5 py-3 font-mono text-xs text-ink">{row.version}</td>
                  <td className="px-5 py-3">
                    <VersionBadge status={row.status} />
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-ink">
                    {formatNumber(row.users)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-muted">
                    {formatNumber(row.launches)}
                  </td>
                </tr>
              ))}
              {data.versionUsage.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">
                    No CLI launches in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-pretty text-xs leading-5 text-muted">
        Harness charts use cli_started events. Model charts use distinct session_started IDs because
        cli_started does not include a model. “Unknown” means that the harness did not report one.
      </p>
    </>
  );
}

type PieItem = { label: string; value: number; detail?: string; color: string };

function PieCard({
  title,
  subtitle,
  items,
  centerLabel,
}: {
  title: string;
  subtitle: string;
  items: PieItem[];
  centerLabel: string;
}) {
  const positiveItems = items.filter((item) => item.value > 0);
  const total = positiveItems.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = positiveItems.map((item) => {
    const start = cursor;
    cursor += total === 0 ? 0 : (item.value / total) * 360;
    return `${item.color} ${start}deg ${cursor}deg`;
  });
  const background = stops.length > 0 ? `conic-gradient(${stops.join(", ")})` : "#eceef1";

  return (
    <article className="rounded-xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_-1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
      <h2 className="text-balance text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-pretty text-xs text-muted">{subtitle}</p>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
        <div
          className="relative size-36 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
          style={{ background }}
          role="img"
          aria-label={`${title}: ${positiveItems.map((item) => `${item.label} ${item.value}`).join(", ") || "no data"}`}
        >
          <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">
              {formatNumber(total)}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">
              {centerLabel}
            </span>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-2.5">
          {positiveItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink" title={item.label}>
                    {item.label}
                  </div>
                  {item.detail && <div className="mt-0.5 text-muted">{item.detail}</div>}
                </div>
              </div>
              <div className="shrink-0 text-right font-mono tabular-nums text-ink">
                {formatPercent(total === 0 ? 0 : item.value / total)}
              </div>
            </div>
          ))}
          {positiveItems.length === 0 && (
            <p className="text-xs text-muted">No activity in this window.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_-1px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-2 text-pretty text-xs leading-5 text-muted">{detail}</div>
    </article>
  );
}

function FilterBar({
  range,
  onRangeChange,
  hideInternal,
  canHideInternal,
  onHideInternalChange,
}: {
  range: CliUsageRange;
  onRangeChange: (range: CliUsageRange) => void;
  hideInternal: boolean;
  canHideInternal: boolean;
  onHideInternalChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-xl bg-code p-1.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
      role="group"
      aria-label="CLI usage filters"
    >
      {(["24h", "7d"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onRangeChange(option)}
          aria-pressed={range === option}
          className={`min-h-10 rounded-lg px-4 text-xs font-medium tabular-nums transition-[background-color,color,box-shadow,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96] ${range === option ? "bg-white text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted hover:text-ink"}`}
        >
          {option === "24h" ? "Last 24 hours" : "Last 7 days"}
        </button>
      ))}
      <span className="mx-1 h-6 w-px bg-line-strong" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onHideInternalChange(!hideInternal)}
        aria-pressed={hideInternal}
        disabled={!canHideInternal}
        className={`min-h-10 rounded-lg px-4 text-xs font-medium transition-[background-color,color,box-shadow,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.96] ${hideInternal ? "bg-ink text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)]" : "text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"}`}
      >
        {hideInternal ? "Internal hidden" : "Hide internal"}
      </button>
    </div>
  );
}

function VersionBadge({ status }: { status: CliUsageData["versionUsage"][number]["status"] }) {
  const styles = {
    latest: "bg-emerald-50 text-emerald-700",
    newer: "bg-blue-50 text-blue-700",
    outdated: "bg-amber-50 text-amber-700",
    unknown: "bg-slate-100 text-slate-600",
  }[status];
  const label = status === "newer" ? "Newer build" : status[0]?.toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function RefreshStatus({
  refreshing,
  lastUpdated,
}: {
  refreshing: boolean;
  lastUpdated: number | null;
}) {
  return (
    <div className="min-h-10 text-right text-xs text-muted" aria-live="polite">
      <div>{refreshing ? "Refreshing…" : "Auto-refreshes every 15s"}</div>
      {lastUpdated && (
        <div className="mt-1 font-mono tabular-nums">
          Updated {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function compactPieItems(items: PieItem[]): PieItem[] {
  if (items.length <= PIE_COLORS.length) return items;
  const visible = items.slice(0, PIE_COLORS.length - 1);
  const rest = items.slice(PIE_COLORS.length - 1);
  return [
    ...visible,
    {
      label: "Other",
      value: rest.reduce((sum, item) => sum + item.value, 0),
      detail: `${rest.length} models`,
      color: PIE_COLORS[PIE_COLORS.length - 1] ?? "#64748b",
    },
  ];
}

function rangeLabel(range: CliUsageRange): string {
  return range === "24h" ? "Last 24 hours" : "Last 7 days";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}

function plural(value: number, noun: string): string {
  return value === 1 ? noun : `${noun}s`;
}
