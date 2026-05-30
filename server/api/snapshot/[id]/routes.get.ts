import { readFile } from 'node:fs/promises'

// GET /api/snapshot/:id/routes -> raw routes.json for a snapshot (verbatim string).
// Used for analytics parity / multi-snapshot access; the single-flight endpoints
// continue to use the configured snapshot via routesCache.
export default defineEventHandler(async (event) => {
  const id = requireSnapshotId(getRouterParam(event, 'id'))
  let raw: string
  try {
    raw = await readFile(dataPath(id, 'routes.json'), 'utf-8')
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'routes.json not found for snapshot' })
  }
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return raw
})
