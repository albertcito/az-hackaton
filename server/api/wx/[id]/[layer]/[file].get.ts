import { readFile } from 'node:fs/promises'

const LAYERS = new Set(['refc', 'retop'])
const FILE_RE = /^[\w.\-]+\.npz$/

// GET /api/wx/:id/:layer/:file -> raw .npz bytes for a weather strip.
// Replaces the old static /<snap>/<snap>/wx/... path, which carried illegal
// colons on Windows. The client builds colon-free names (app/utils/weatherStrips.ts).
export default defineEventHandler(async (event) => {
  const id = requireSnapshotId(getRouterParam(event, 'id'))
  const layer = decodeURIComponent(getRouterParam(event, 'layer') ?? '')
  const file = decodeURIComponent(getRouterParam(event, 'file') ?? '')

  if (!LAYERS.has(layer)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid weather layer' })
  }
  if (!FILE_RE.test(file)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid weather filename' })
  }

  let buf: Buffer
  try {
    buf = await readFile(dataPath(id, 'wx', layer, file))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Weather strip not found' })
  }

  setResponseHeader(event, 'Content-Type', 'application/octet-stream')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return buf
})
