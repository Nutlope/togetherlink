import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { ConvexHttpClient } from 'convex/browser'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'

type DashboardSummary = Awaited<ReturnType<typeof fetchSummary>>

const REFRESH_INTERVAL_MS = 15_000

async function dashboardSession() {
  return useSession<{ authed?: boolean }>({
    name: 'togetherlink-dashboard',
    password: process.env.DASHBOARD_SESSION_SECRET ?? 'togetherlink-dashboard-dev-secret-change-me',
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
}

async function fetchSummary() {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL
  if (!url) {
    return null
  }
  const client = new ConvexHttpClient(url)
  return client.query(api.analytics.getDashboardSummary, { days: 30 })
}

const checkDashboardAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await dashboardSession()
  return { authed: Boolean(session.data.authed) }
})

const loginToDashboard = createServerFn({ method: 'POST' })
  .validator((password: string) => password)
  .handler(async ({ data: password }) => {
    const expected = process.env.DASHBOARD_PASSWORD
    if (!expected || password !== expected) {
      throw new Error('Invalid password')
    }
    const session = await dashboardSession()
    await session.update({ authed: true })
    return { ok: true }
  })

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await dashboardSession()
  if (!session.data.authed) {
    throw new Error('Not authorized')
  }
  return fetchSummary()
})

export const Route = createFileRoute('/dashboard')({
  loader: async () => checkDashboardAuth(),
  component: DashboardRoute,
})

function DashboardRoute() {
  const { authed } = Route.useLoaderData()
  const [isAuthed, setIsAuthed] = useState(authed)
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  // `loading` only covers the very first fetch (full-page spinner state).
  // `refreshing` covers every poll after that — it never unmounts the
  // existing tables, so a 15s refresh can't cause a layout shift.
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const loadData = async (isFirstLoad: boolean) => {
    if (isFirstLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      const result = await getDashboardData()
      setData(result)
      setLastUpdated(Date.now())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAuthed) return
    const interval = setInterval(() => void loadData(false), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthed])

  if (!isAuthed) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-6">
        <h1 className="font-mono text-lg font-semibold text-ink">togetherlink analytics</h1>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await loginToDashboard({ data: password })
              setIsAuthed(true)
              await loadData(true)
            } catch {
              setError('Invalid password')
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
    )
  }

  if (!data && !loading) {
    void loadData(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-lg font-semibold text-ink">togetherlink analytics</h1>
        <RefreshStatus refreshing={refreshing} lastUpdated={lastUpdated} />
      </header>

      <div className="mb-6 rounded-md border border-line-strong bg-code px-4 py-3 text-sm text-muted">
        Scope: this dashboard only sees sessions launched through{' '}
        <code className="font-mono text-ink">togetherlink claude</code> /{' '}
        <code className="font-mono text-ink">togetherlink codex</code>, which route through our proxy. OpenCode
        sessions and any direct Together API key usage bypass the proxy entirely and are not counted here — so
        these numbers are a lower bound on total usage, not the whole picture.
      </div>

      {loading && !data && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard title="Active installs / day" rows={data.activeInstallsPerDay.map((r) => [r.day, r.count])} />
          <StatCard title="Installs completed / day" rows={data.installsPerDay.map((r) => [r.day, r.count])} />
          <StatCard title="Sessions started / day" rows={data.sessionsStartedPerDay.map((r) => [r.day, r.count])} />
          <StatCard title="Sessions ended / day" rows={data.sessionsEndedPerDay.map((r) => [r.day, r.count])} />

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
            title="Country distribution"
            items={data.countryDistribution.map((r) => ({
              label: `${flagFor(r.countryCode)} ${r.countryCode}`,
              value: r.count,
              valueLabel: String(r.count),
            }))}
          />

          <BarCard
            title="OS distribution"
            items={data.osDistribution.map((r) => ({ label: r.os, value: r.count, valueLabel: String(r.count) }))}
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
              <div className="font-mono text-base text-ink">{(data.failedSessionRate * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-muted">Total events (30d)</div>
              <div className="font-mono text-base text-ink">{data.totalEvents}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RefreshStatus({ refreshing, lastUpdated }: { refreshing: boolean; lastUpdated: number | null }) {
  const [, setTick] = useState(0)
  // Re-render once a second so the "Xs ago" text stays current without
  // needing its own data refresh.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className={`inline-block h-2 w-2 rounded-full ${refreshing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      <span>
        {refreshing ? 'Refreshing…' : secondsAgo !== null ? `Updated ${secondsAgo}s ago` : 'Loading…'} · auto-refreshes
        every {REFRESH_INTERVAL_MS / 1000}s
      </span>
    </div>
  )
}

function StatCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0)
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
  )
}

function BarCard({
  title,
  items,
  className,
}: {
  title: string
  items: Array<{ label: string; value: number; detail?: string; valueLabel: string }>
  className?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className={`rounded-lg border border-line-strong p-4 ${className ?? ''}`}>
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
  )
}

function formatTokens(n: number): string {
  return n.toLocaleString('en-US')
}

// Renders an ISO 3166-1 alpha-2 country code as its flag emoji via regional
// indicator symbols. Falls back to a globe for codes we can't map (e.g. "unknown").
function flagFor(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) {
    return '🌐'
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
