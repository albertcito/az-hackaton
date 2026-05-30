import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// GET /api/scorecard -> the cross-snapshot scorecard (baseline vs mitigated).
export default defineEventHandler(async (event) => {
  let raw: string
  try {
    raw = await readFile(join(DERIVED_DIR, 'scorecard.json'), 'utf-8')
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'scorecard.json not computed (run: python -m analytics.precompute --all)',
    })
  }
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return raw
})
