import { createFileRoute } from '@tanstack/react-router'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'

const VALID_EVENT_TYPES = new Set([
  'install_completed',
  'cli_started',
  'session_started',
  'session_ended',
])

const VALID_OS = new Set(['macos', 'linux', 'windows', 'unknown'])

interface TelemetryPayload {
  installId: string
  sessionId?: string
  event: string
  version?: string
  agent?: string
  initialModel?: string
  finalModel?: string
  model?: string
  os?: string
  arch?: string
  startedAt?: number
  endedAt?: number
  durationMs?: number
  usage?: {
    promptTokens?: number
    cachedTokens?: number
    completionTokens?: number
    costUsd?: number
  }
  usageByModel?: Array<{
    model: string
    promptTokens?: number
    cachedTokens?: number
    completionTokens?: number
    costUsd?: number
  }>
  metadata?: Record<string, unknown>
  exitCode?: number
  signal?: string
  errorKind?: string
}

function isTelemetryPayload(value: unknown): value is TelemetryPayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.installId === 'string' &&
    v.installId.length > 0 &&
    typeof v.event === 'string' &&
    VALID_EVENT_TYPES.has(v.event)
  )
}

function normalizeOs(os: unknown): string {
  return typeof os === 'string' && VALID_OS.has(os) ? os : 'unknown'
}

function getConvexClient(): ConvexHttpClient | null {
  const url = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL
  if (!url) return null
  return new ConvexHttpClient(url)
}

export const Route = createFileRoute('/api/telemetry')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return new Response(null, { status: 400 })
        }

        if (!isTelemetryPayload(body)) {
          return new Response(null, { status: 400 })
        }

        const countryCode = request.headers.get('x-vercel-ip-country') ?? 'unknown'
        const receivedAt = Date.now()

        const client = getConvexClient()
        if (!client) {
          return new Response(null, { status: 204 })
        }

        try {
          await client.mutation(api.telemetry.recordEvent, {
            installId: body.installId,
            sessionId: body.sessionId,
            eventType: body.event,
            cliVersion: body.version,
            agent: body.agent,
            initialModel: body.initialModel,
            finalModel: body.finalModel,
            model: body.model,
            countryCode,
            os: normalizeOs(body.os),
            arch: body.arch,
            startedAt: body.startedAt,
            endedAt: body.endedAt,
            durationMs: body.durationMs,
            promptTokens: body.usage?.promptTokens,
            cachedTokens: body.usage?.cachedTokens,
            completionTokens: body.usage?.completionTokens,
            costUsd: body.usage?.costUsd,
            usageByModel: body.usageByModel,
            metadata: body.metadata,
            exitCode: body.exitCode,
            signal: body.signal,
            errorKind: body.errorKind,
            receivedAt,
          })
        } catch {
          // Telemetry must never break the caller. Swallow ingestion errors.
        }

        return new Response(null, { status: 204 })
      },
    },
  },
})
