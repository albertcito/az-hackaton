import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// GET /api/snapshot/:id/:artifact -> a precomputed derived JSON artifact.
// (The static /routes route takes precedence over this dynamic segment.)
const ARTIFACTS = new Set(['demand', 'members', 'attribution', 'mitigation'])

export default defineEventHandler(async (event) => {
  const id = requireSnapshotId(getRouterParam(event, 'id'))
  const artifact = decodeURIComponent(getRouterParam(event, 'artifact') ?? '')
  if (!ARTIFACTS.has(artifact)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown artifact' })
  }
  let raw: string
  try {
    raw = await readFile(join(DERIVED_DIR, id, `${artifact}.json`), 'utf-8')
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: `${artifact}.json not precomputed (run analytics.precompute)`,
    })
  }
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=30')
  return raw
})
