// POST /api/session/:id/reset -> clear applied actions, return baseline delta.
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') ?? '')
  const session = getSession(id)
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })
  const engine = await getEngine(session)
  engine.reset()
  return { reset: true, ...engine.delta() }
})
