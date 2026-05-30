// GET /api/snapshots -> list of materialized snapshots (sanitized id + ISO asked_at)
export default defineEventHandler(async () => {
  return { snapshots: await listSnapshots() }
})
