import { scanPenetration } from '../../../utils/opsAlerts'

// GET /api/session/:id/alerts?status=&now= -> current alerts.
// When `now` is provided, refresh the auto convective-penetration alerts first.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  const session = getSession(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })
  const q = getQuery(event)
  const now = String(q.now ?? '')
  if (now) {
    try { await scanPenetration(session, now, 30) } catch { /* ignore */ }
  }
  const status = String(q.status ?? '')
  const alerts = status ? session.alerts.filter(a => a.status === status) : session.alerts
  return { alerts }
})
