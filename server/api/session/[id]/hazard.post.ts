import { raiseHazard } from '../../../utils/opsAlerts'
import type { Region } from '../../../utils/opsLookahead'
import type { AlertKind } from '~/types/alert'

const HORIZON_CAP_MS = 60 * 60000
const KINDS = new Set(['turbulence', 'convection', 'closure'])

// POST /api/session/:id/hazard { region, kind, window?, now } -> new/updated alert + full list.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  const session = getSession(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })

  const body = await readBody<{ region?: Region, kind?: string, window?: { from?: string, to?: string }, now?: string }>(event)
  if (!body?.region) throw createError({ statusCode: 400, statusMessage: 'region required' })
  if (!body?.kind || !KINDS.has(body.kind)) throw createError({ statusCode: 400, statusMessage: 'kind must be turbulence|convection|closure' })

  const nowIso = body.now ?? new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const fromIso = body.window?.from ?? nowIso
  const fromMs = Date.parse(fromIso)
  let toMs = body.window?.to ? Date.parse(body.window.to) : nowMs + 30 * 60000
  toMs = Math.min(toMs, fromMs + HORIZON_CAP_MS)

  const alert = await raiseHazard(session, body.region, body.kind as AlertKind, fromIso, new Date(toMs).toISOString(), nowIso)
  return { alert, alerts: session.alerts }
})
