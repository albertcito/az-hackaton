import { join, resolve, sep } from 'node:path'
import { readdir } from 'node:fs/promises'
import { sanitizeSnapshotId, snapshotIdToAskedAt } from '~/utils/snapshotId'

// Raw data is materialized (colon-free) under <repo>/data — see
// scripts/materialize_data.py. Everything is served from here, never from
// public/, because public/ static paths would carry illegal colons on Windows.
export const DATA_DIR = join(process.cwd(), 'data')
export const DERIVED_DIR = join(DATA_DIR, 'derived')

/**
 * Resolve a path inside DATA_DIR from caller-supplied segments, guarding
 * against directory traversal (`..`, absolute escapes).
 */
export function dataPath(...segments: string[]): string {
  const base = resolve(DATA_DIR)
  const full = resolve(base, ...segments)
  if (full !== base && !full.startsWith(base + sep)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid data path' })
  }
  return full
}

const SNAPSHOT_ID_RE = /^asked_at_[\w.\-]+$/

/** Validate + sanitize a snapshot id from a request param. Throws on garbage. */
export function requireSnapshotId(raw: string | undefined): string {
  const id = sanitizeSnapshotId(decodeURIComponent(raw ?? '').trim())
  if (!SNAPSHOT_ID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid snapshot id' })
  }
  return id
}

export interface SnapshotMeta {
  id: string // sanitized, colon-free (matches on-disk dir + URLs)
  asked_at: string // ISO with colons (canonical timestamp)
}

/** List materialized snapshots under data/, sorted by asked_at ascending. */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  let entries
  try {
    entries = await readdir(DATA_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith('asked_at_'))
    .map((e) => ({ id: e.name, asked_at: snapshotIdToAskedAt(e.name) }))
    .sort((a, b) => a.asked_at.localeCompare(b.asked_at))
}
