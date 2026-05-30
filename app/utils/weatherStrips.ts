import { askedAtToSnapshotId } from '~/utils/snapshotId'

const STRIP_MS = 15 * 60 * 1000
const ANCHOR_OFFSET_MS = 7.5 * 60 * 1000

// Weather strip filenames are colon-free on disk (':' -> '-', see
// scripts/materialize_data.py), so we format timestamps with dashes here to
// match the materialized names directly.
function formatWxTimestamp(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`
}

export function askedAtSnapshotDir(askedAt: string): string {
  return askedAtToSnapshotId(askedAt)
}

export function weatherBasedAt(askedAt: string): Date {
  const d = new Date(askedAt)
  d.setUTCMinutes(0, 0, 0)
  return d
}

export function weatherStripFilename(basedAt: Date, timeMs: number): string {
  const anchorMs = basedAt.getTime() - ANCHOR_OFFSET_MS
  const idx = Math.floor((timeMs - anchorMs) / STRIP_MS)
  const validFromMs = anchorMs + idx * STRIP_MS
  const validToMs = validFromMs + STRIP_MS
  const basedAtStr = formatWxTimestamp(basedAt.getTime())
  return `${basedAtStr}_${formatWxTimestamp(validFromMs)}_${formatWxTimestamp(validToMs)}.npz`
}

export function weatherStripUrl(
  askedAt: string,
  layer: 'refc' | 'retop',
  timeMs: number
): string {
  const dir = askedAtSnapshotDir(askedAt)
  const basedAt = weatherBasedAt(askedAt)
  const filename = weatherStripFilename(basedAt, timeMs)
  return `/api/wx/${dir}/${layer}/${filename}`
}
