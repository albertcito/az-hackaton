// GET /api/session/:id/alerts?status= -> current alerts (optionally filtered).
export default defineEventHandler((event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  const session = getSession(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })
  const status = String(getQuery(event).status ?? '')
  const alerts = status ? session.alerts.filter(a => a.status === status) : session.alerts
  return { alerts }
})
