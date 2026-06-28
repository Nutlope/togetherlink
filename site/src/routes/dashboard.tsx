import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { ConvexHttpClient } from 'convex/browser'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'

type DashboardSummary = Awaited<ReturnType<typeof fetchSummary>>

async function dashboardSession() {
  return useSession<{ authed?: boolean }>({
    name: 'togetherlink-dashboard',
    password: process.env.DASHBOARD_SESSION_SECRET ?? 'togetherlink-dashboard-dev-secret-change-me',
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
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getDashboardData()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthed) {
    return (
      <div style={{ maxWidth: 400, margin: '4rem auto', fontFamily: 'monospace' }}>
        <h1>togetherlink analytics</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await loginToDashboard({ data: password })
              setIsAuthed(true)
              await loadData()
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
            style={{ padding: '0.5rem', width: '100%' }}
          />
          <button type="submit" style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}>
            Sign in
          </button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  if (!data && !loading) {
    void loadData()
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', fontFamily: 'monospace' }}>
      <h1>togetherlink analytics (last 30 days)</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {data && (
        <>
          <Section title="Active installs / day" rows={data.activeInstallsPerDay.map((r) => [r.day, String(r.count)])} />
          <Section title="Installs completed / day" rows={data.installsPerDay.map((r) => [r.day, String(r.count)])} />
          <Section title="Sessions started / day" rows={data.sessionsStartedPerDay.map((r) => [r.day, String(r.count)])} />
          <Section title="Sessions ended / day" rows={data.sessionsEndedPerDay.map((r) => [r.day, String(r.count)])} />
          <Section
            title="Token usage by agent"
            rows={data.tokenUsageByAgent.map((r) => [
              r.agent,
              `prompt ${r.promptTokens} / cached ${r.cachedTokens} / completion ${r.completionTokens} / $${r.costUsd.toFixed(4)}`,
            ])}
          />
          <Section
            title="Token usage by model"
            rows={data.tokenUsageByModel.map((r) => [
              r.model,
              `prompt ${r.promptTokens} / cached ${r.cachedTokens} / completion ${r.completionTokens} / $${r.costUsd.toFixed(4)}`,
            ])}
          />
          <Section title="OS distribution" rows={data.osDistribution.map((r) => [r.os, String(r.count)])} />
          <Section title="Country distribution" rows={data.countryDistribution.map((r) => [r.countryCode, String(r.count)])} />
          <Section title="CLI version adoption" rows={data.versionDistribution.map((r) => [r.version, String(r.count)])} />
          <p>Failed session rate: {(data.failedSessionRate * 100).toFixed(1)}%</p>
          <p>Total events: {data.totalEvents}</p>
        </>
      )}
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ borderBottom: '1px solid #ccc', padding: '0.25rem' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
