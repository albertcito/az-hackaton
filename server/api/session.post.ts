import { sanitizeSnapshotId } from '~/utils/snapshotId'

// POST /api/session { snapshot? } -> creates an assistant session for a snapshot.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ snapshot?: string }>(event)
  const snapshot = sanitizeSnapshotId(String(body?.snapshot || config.routesSnapshotDir))
  const derived = await getDerived(snapshot)
  if (!derived.demand) {
    throw createError({ statusCode: 404, statusMessage: 'snapshot not precomputed' })
  }
  const session = createSession(snapshot)
  return {
    session_id: session.id,
    snapshot,
    has_assistant: Boolean(config.anthropicApiKey),
  }
})
