// POST /api/session/:id/alerts/:aid/resolve -> mark an alert resolved.
export default defineEventHandler((event) => {
  const session = getSession(String(getRouterParam(event, 'id') ?? ''))
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })
  const aid = getRouterParam(event, 'aid')
  const a = session.alerts.find(x => x.id === aid)
  if (a) a.status = 'resolved'
  return { alerts: session.alerts }
})
