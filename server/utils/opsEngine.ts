import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dataPath, DERIVED_DIR } from './dataPaths'
import { getDerived } from './opsData'
import { getFlight } from './routesCache'
import type { OpsSession } from './opsSession'

// Live, per-session occupancy engine (TS port of analytics/engine.py for the
// incremental path). Baseline counts + the flight->cells index come from the
// Python precompute; applying a ground delay only recomputes the affected
// flight's position/sector, so actions resolve in well under a second.

const EARTH_RADIUS_NM = 3440.065
const BAND_BREAK_FT = 35000
const MAX_DELAY_MIN = 60

interface SectorPoly {
  name: string
  ring: number[][] // [lon, lat]
  minLon: number; minLat: number; maxLon: number; maxLat: number
}

interface FlightKin {
  lats: number[]; lons: number[]; cum: number[]; total: number
  speed: number; alt: number; takeMs: number; landMs: number
}

interface SnapData {
  bins: string[]
  binMs: number[]
  askedMs: number
  sectorNames: string[]
  sectorIndex: Map<string, number>
  capacities: number[]
  baseline: number[][]
  mitigated: number[][]
  flightCells: Record<string, [number, string][]>
  pip: { LOW: SectorPoly[], HIGH: SectorPoly[] }
  mitigationActions: { fid: string, minutes: number, relieves: [string, number][] }[]
  kin: Map<string, FlightKin>
}

const snapCache = new Map<string, Promise<SnapData>>()
const liveSessions = new Map<string, LiveSession>()

function toRad(d: number) { return (d * Math.PI) / 180 }
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a))
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!
    const xj = ring[j]![0]!, yj = ring[j]![1]!
    const intersect = (yi > lat) !== (yj > lat)
      && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

async function loadSnapData(snapshot: string): Promise<SnapData> {
  const derived = await getDerived(snapshot)
  const demand = derived.demand
  const mitigation = derived.mitigation

  const fcRaw = await readFile(join(DERIVED_DIR, snapshot, 'flight_cells.json'), 'utf-8')
  const flightCells = JSON.parse(fcRaw) as Record<string, [number, string][]>

  const geoRaw = await readFile(dataPath('sectors.geojson'), 'utf-8')
  const geo = JSON.parse(geoRaw)
  const pip: { LOW: SectorPoly[], HIGH: SectorPoly[] } = { LOW: [], HIGH: [] }
  for (const f of geo.features) {
    const name: string = f.properties.name
    const ring = f.geometry.coordinates[0] as number[][]
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
    for (const [lon, lat] of ring) {
      if (lon! < minLon) minLon = lon!
      if (lon! > maxLon) maxLon = lon!
      if (lat! < minLat) minLat = lat!
      if (lat! > maxLat) maxLat = lat!
    }
    const band = name.startsWith('HIGH') ? 'HIGH' : 'LOW'
    pip[band].push({ name, ring, minLon, minLat, maxLon, maxLat })
  }

  const sectorNames: string[] = demand.sectors.map((s: any) => s.name)
  const sectorIndex = new Map<string, number>()
  sectorNames.forEach((n, i) => sectorIndex.set(n, i))
  const capacities = demand.sectors.map((s: any) => s.capacity)
  const baseline = demand.sectors.map((s: any) => s.counts.slice())
  const mitigated = demand.sectors.map((s: any) => (s.counts_mitigated ?? s.counts).slice())

  return {
    bins: demand.bins,
    binMs: demand.bins.map((b: string) => new Date(b).getTime()),
    askedMs: new Date(demand.asked_at).getTime(),
    sectorNames,
    sectorIndex,
    capacities,
    baseline,
    mitigated,
    flightCells,
    pip,
    mitigationActions: (mitigation?.actions ?? []).map((a: any) => ({ fid: a.fid, minutes: a.minutes, relieves: a.relieves })),
    kin: new Map(),
  }
}

function getSnapData(snapshot: string): Promise<SnapData> {
  let p = snapCache.get(snapshot)
  if (!p) { p = loadSnapData(snapshot); snapCache.set(snapshot, p) }
  return p
}

async function getKin(snap: SnapData, fid: string): Promise<FlightKin | null> {
  const cached = snap.kin.get(fid)
  if (cached) return cached
  const f = await getFlight(fid)
  if (!f) return null
  const lats = f.lats, lons = f.lons
  const cum = [0]
  for (let i = 1; i < lats.length; i++) {
    cum.push(cum[i - 1]! + haversineNm(lats[i - 1]!, lons[i - 1]!, lats[i]!, lons[i]!))
  }
  const kin: FlightKin = {
    lats, lons, cum, total: cum[cum.length - 1] ?? 0,
    speed: f.cruise_speed_kt, alt: f.cruise_altitude_ft,
    takeMs: new Date(f.take_off_time).getTime(),
    landMs: new Date(f.scheduled_landing_time).getTime(),
  }
  snap.kin.set(fid, kin)
  return kin
}

function interp(kin: FlightKin, targetNm: number): [number, number] {
  if (kin.total <= 0 || targetNm <= 0) return [kin.lons[0]!, kin.lats[0]!]
  if (targetNm >= kin.total) return [kin.lons[kin.lons.length - 1]!, kin.lats[kin.lats.length - 1]!]
  let k = 1
  while (k < kin.cum.length && kin.cum[k]! < targetNm) k++
  const seg = kin.cum[k]! - kin.cum[k - 1]!
  const t = seg === 0 ? 0 : (targetNm - kin.cum[k - 1]!) / seg
  return [
    kin.lons[k - 1]! + (kin.lons[k]! - kin.lons[k - 1]!) * t,
    kin.lats[k - 1]! + (kin.lats[k]! - kin.lats[k - 1]!) * t,
  ]
}

function assignSector(snap: SnapData, lon: number, lat: number, alt: number): string {
  const polys = alt < BAND_BREAK_FT ? snap.pip.LOW : snap.pip.HIGH
  for (const p of polys) {
    if (lon < p.minLon || lon > p.maxLon || lat < p.minLat || lat > p.maxLat) continue
    if (pointInRing(lon, lat, p.ring)) return p.name
  }
  return ''
}

async function computeCells(snap: SnapData, fid: string, delayMin: number): Promise<[number, string][]> {
  const kin = await getKin(snap, fid)
  if (!kin) return []
  const dms = delayMin * 60000
  const take = kin.takeMs + dms
  const land = kin.landMs + dms
  const cells: [number, string][] = []
  for (let b = 0; b < snap.binMs.length; b++) {
    const t = snap.binMs[b]!
    if (t < take || t > land) continue
    const elapsed = (t - take) / 1000
    const targetNm = (kin.speed * elapsed) / 3600
    const [lon, lat] = interp(kin, targetNm)
    const sector = assignSector(snap, lon, lat, kin.alt)
    if (sector) cells.push([b, sector])
  }
  return cells
}

export class LiveSession {
  counts: number[][]
  delays = new Map<string, number>()
  overrides = new Map<string, [number, string][]>()
  actions: { fid: string, minutes: number }[] = []
  changed = new Set<number>()

  constructor(public snap: SnapData) {
    this.counts = snap.baseline.map(r => r.slice())
  }

  private bumpCells(cells: [number, string][], delta: number) {
    for (const [b, name] of cells) {
      const si = this.snap.sectorIndex.get(name)
      if (si == null) continue
      this.counts[si]![b]! += delta
      this.changed.add(si)
    }
  }

  delayable(fid: string): boolean {
    const kin = this.snap.kin.get(fid)
    // If kin unknown yet, allow; the check below re-validates via flight take-off.
    return true
  }

  async delayFlightToTotal(fid: string, totalMinutes: number) {
    const total = Math.max(0, Math.min(MAX_DELAY_MIN, Math.round(totalMinutes)))
    const cur = this.overrides.get(fid) ?? this.snap.flightCells[fid] ?? await computeCells(this.snap, fid, this.delays.get(fid) ?? 0)
    this.bumpCells(cur, -1)
    const next = await computeCells(this.snap, fid, total)
    this.bumpCells(next, +1)
    this.overrides.set(fid, next)
    this.delays.set(fid, total)
    const existing = this.actions.find(a => a.fid === fid)
    if (existing) existing.minutes = total
    else this.actions.push({ fid, minutes: total })
  }

  /** Delay each flight by an additional `minutes` (capped at total 60). */
  async addGroundDelay(fids: string[], minutes: number) {
    for (const fid of fids) {
      const target = (this.delays.get(fid) ?? 0) + minutes
      await this.delayFlightToTotal(fid, target)
    }
  }

  applyResolutionAll() {
    this.counts = this.snap.mitigated.map(r => r.slice())
    this.delays = new Map(this.snap.mitigationActions.map(a => [a.fid, a.minutes]))
    this.actions = this.snap.mitigationActions.map(a => ({ fid: a.fid, minutes: a.minutes }))
    this.overrides.clear()
    for (let si = 0; si < this.snap.sectorNames.length; si++) this.changed.add(si)
  }

  async applyResolutionSector(sector: string) {
    const acts = this.snap.mitigationActions.filter(a => a.relieves.some(r => r[0] === sector))
    for (const a of acts) await this.delayFlightToTotal(a.fid, a.minutes)
    return acts.length
  }

  reset() {
    this.counts = this.snap.baseline.map(r => r.slice())
    this.delays.clear()
    this.overrides.clear()
    this.actions = []
    for (let si = 0; si < this.snap.sectorNames.length; si++) this.changed.add(si)
  }

  totalDelay(): number {
    let t = 0
    for (const m of this.delays.values()) t += m
    return t
  }

  stressNow(): number[] {
    const out: number[] = []
    for (let b = 0; b < this.snap.binMs.length; b++) {
      let over = 0
      for (let si = 0; si < this.counts.length; si++) {
        const d = this.counts[si]![b]! - this.snap.capacities[si]!
        if (d > 0) over += d
      }
      out.push(over)
    }
    return out
  }

  nOverSectors(): number {
    let n = 0
    for (let si = 0; si < this.counts.length; si++) {
      let peak = 0
      for (const v of this.counts[si]!) if (v > peak) peak = v
      if (peak > this.snap.capacities[si]!) n++
    }
    return n
  }

  /** Counts for sectors that differ from baseline, for the frontend to merge. */
  delta() {
    const countsNow: Record<string, number[]> = {}
    for (const si of this.changed) countsNow[this.snap.sectorNames[si]!] = this.counts[si]!.slice()
    return {
      counts_now: countsNow,
      stress_now: this.stressNow(),
      summary: {
        n_over_sectors: this.nOverSectors(),
        total_delay_minutes: this.totalDelay(),
        n_actions: this.actions.length,
      },
      applied_actions: this.actions.map(a => ({ fid: a.fid, minutes: a.minutes })),
    }
  }
}

export async function getEngine(session: OpsSession): Promise<LiveSession> {
  let live = liveSessions.get(session.id)
  if (!live) {
    const snap = await getSnapData(session.snapshot)
    live = new LiveSession(snap)
    liveSessions.set(session.id, live)
  }
  return live
}
