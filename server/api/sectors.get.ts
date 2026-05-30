import { readFile } from 'node:fs/promises'

// GET /api/sectors -> raw sectors.geojson (712 features) for 3D extrusion.
// Cached in memory; returned as a verbatim JSON string so we avoid re-serializing 2 MB.
let cache: string | null = null

export default defineEventHandler(async (event) => {
  if (!cache) {
    try {
      cache = await readFile(dataPath('sectors.geojson'), 'utf-8')
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'sectors.geojson not materialized (run scripts/materialize_data.py)' })
    }
  }
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return cache
})
