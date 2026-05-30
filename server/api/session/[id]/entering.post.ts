import { flightsEntering, type Region } from '../../../utils/opsLookahead'

const HORIZON_CAP_MS = 60 * 60000

// POST /api/session/:id/entering { region, window?, now } -> flights entering the region.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  const session = getSession(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })

  const body = await readBody<{ region?: Region, window?: { from?: string, to?: string }, now?: string, altBand?: 'LOW' | 'HIGH' }>(event)
  if (!body?.region) throw createError({ statusCode: 400, statusMessage: 'region required' })

  const nowMs = body.now ? new Date(body.now).getTime() : Date.now()
  const fromMs = body.window?.from ? new Date(body.window.from).getTime() : nowMs
  let toMs = body.window?.to ? new Date(body.window.to).getTime() : nowMs + 30 * 60000
  toMs = Math.min(toMs, fromMs + HORIZON_CAP_MS)

  const res = await flightsEntering(session.snapshot, body.region, nowMs, fromMs, toMs, body.altBand ?? null)
  if ('error' in res) throw createError({ statusCode: 400, statusMessage: res.error })
  return { window: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() }, ...res }
})
