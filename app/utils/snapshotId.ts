// Colons are illegal in Windows filenames. The hackathon data bundle uses
// colons in snapshot directory names (asked_at_2026-04-08T18:00:00Z) and in
// weather strip filenames (..._18:00:00_...npz). We materialize the bundle with
// ':' -> '-' (see scripts/materialize_data.py); these helpers map between the
// colon-bearing canonical form and the Windows-safe on-disk / URL form.

/** Replace ':' with '-' so a snapshot id or filename is Windows-safe. */
export function sanitizeSnapshotId(id: string): string {
  return id.replace(/:/g, '-')
}

/**
 * Recover the ISO asked_at timestamp from a sanitized snapshot dir name.
 * `asked_at_2026-04-08T18-00-00Z` -> `2026-04-08T18:00:00Z`.
 * Only dashes in the time portion (after `T`) map back to colons; the date keeps its dashes.
 */
export function snapshotIdToAskedAt(id: string): string {
  const body = id.replace(/^asked_at_/, '')
  const tIndex = body.indexOf('T')
  if (tIndex === -1) return body
  const datePart = body.slice(0, tIndex)
  const timePart = body.slice(tIndex + 1).replace(/-/g, ':')
  return `${datePart}T${timePart}`
}

/** Build the sanitized (colon-free) snapshot dir name from an ISO asked_at timestamp. */
export function askedAtToSnapshotId(askedAt: string): string {
  const iso = new Date(askedAt).toISOString().replace('.000Z', 'Z')
  return sanitizeSnapshotId(`asked_at_${iso}`)
}
