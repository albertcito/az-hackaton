import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Loads + caches the precomputed derived JSON per snapshot, for the assistant's
// read tools. (DERIVED_DIR is auto-imported from server/utils/dataPaths.ts.)

export interface DerivedData {
  demand: any
  members: Record<string, Record<string, string[]>> | null
  attribution: Record<string, Record<string, { weather_displaced: number, n_total: number, n_weather: number }>> | null
  mitigation: any
}

const cache = new Map<string, DerivedData>()

async function readJson(snapshot: string, name: string): Promise<any> {
  try {
    return JSON.parse(await readFile(join(DERIVED_DIR, snapshot, name), 'utf-8'))
  } catch {
    return null
  }
}

export async function getDerived(snapshot: string): Promise<DerivedData> {
  const hit = cache.get(snapshot)
  if (hit) return hit
  const [demand, members, attribution, mitigation] = await Promise.all([
    readJson(snapshot, 'demand.json'),
    readJson(snapshot, 'members.json'),
    readJson(snapshot, 'attribution.json'),
    readJson(snapshot, 'mitigation.json'),
  ])
  const d: DerivedData = { demand, members, attribution, mitigation }
  if (demand) cache.set(snapshot, d)
  return d
}

/** Resolve an ISO time (or null) to a bin index + canonical bin ISO. Null -> peak stress bin. */
export function binFromIso(demand: any, iso?: string | null): { index: number, iso: string } {
  const bins: string[] = demand.bins
  if (!iso) {
    let best = -1
    let bi = 0
    for (const s of demand.stress) if (s.total_over > best) { best = s.total_over; bi = s.bin_index }
    return { index: bi, iso: bins[bi] }
  }
  const t = new Date(iso).getTime()
  let bi = 0
  let bestd = Infinity
  bins.forEach((b: string, i: number) => {
    const dd = Math.abs(new Date(b).getTime() - t)
    if (dd < bestd) { bestd = dd; bi = i }
  })
  return { index: bi, iso: bins[bi] }
}

export function sectorByName(demand: any, name: string): any {
  return demand.sectors.find((s: any) => s.name === name)
}

/** Over-demand sectors at a bin, sorted by over-by desc, with weather %. */
export function hotspotsAt(derived: DerivedData, binIndex: number): any[] {
  const out = []
  for (const s of derived.demand.sectors) {
    const count = s.counts[binIndex] ?? 0
    const over = count - s.capacity
    if (over <= 0) continue
    const wx = derived.attribution?.[s.name]?.[String(binIndex)]?.weather_displaced ?? null
    out.push({
      sector: s.name,
      band: s.band,
      count,
      capacity: s.capacity,
      over_by: over,
      weather_displaced: wx,
    })
  }
  return out.sort((a, b) => b.over_by - a.over_by)
}
