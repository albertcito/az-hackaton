import { assignSector, getSnapData, haversineNm, type SnapData } from './opsEngine'
import { getAllFlights } from './routesCache'
import { buildFlightId } from '~/utils/flightId'

// The one primitive: given a region and a time window, which flights enter it,
// and when? Live (TS), evaluated against the scrubber as "now". Reuses the
// engine's sector polygons (assignSector) + kinematics model.

export type Region =
  | { kind: 'sector', ref: string }
  | { kind: 'circle', lat: number, lon: number, radius_nm: number }
  | { kind: 'poly', coords: number[][] }

interface LFlight {
  fid: string
  lats: number[]; lons: number[]; cum: number[]; total: number
  speed: number; alt: number; takeMs: number; landMs: number
  origin: string; dest: string
  minLat: number; maxLat: number; minLon: number; maxLon: number
}

const tableCache = new Map<string, Promise<LFlight[]>>()

async function buildTable(snapshot: string): Promise<LFlight[]> {
  const flights = await getAllFlights()
  const out: LFlight[] = []
  for (const f of flights) {
    const lats = f.lats, lons = f.lons
    const cum = [0]
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
    for (let i = 0; i < lats.length; i++) {
      if (i > 0) cum.push(cum[i - 1]! + haversineNm(lats[i - 1]!, lons[i - 1]!, lats[i]!, lons[i]!))
      if (lats[i]! < minLat) minLat = lats[i]!
      if (lats[i]! > maxLat) maxLat = lats[i]!
      if (lons[i]! < minLon) minLon = lons[i]!
      if (lons[i]! > maxLon) maxLon = lons[i]!
    }
    out.push({
      fid: buildFlightId(f),
      lats, lons, cum, total: cum[cum.length - 1] ?? 0,
      speed: f.cruise_speed_kt, alt: f.cruise_altitude_ft,
      takeMs: new Date(f.take_off_time).getTime(),
      landMs: new Date(f.scheduled_landing_time).getTime(),
      origin: f.origin_airport_icao, dest: f.destination_airport_icao,
      minLat, maxLat, minLon, maxLon,
    })
  }
  return out
}

export function getFlightTable(snapshot: string): Promise<LFlight[]> {
  let p = tableCache.get(snapshot)
  if (!p) { p = buildTable(snapshot); tableCache.set(snapshot, p) }
  return p
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!
    const xj = ring[j]![0]!, yj = ring[j]![1]!
    if (((yi > lat) !== (yj > lat)) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function positionAt(f: LFlight, tMs: number, takeMs = f.takeMs, landMs = f.landMs): [number, number] | null {
  if (tMs < takeMs || tMs > landMs) return null
  const targetNm = (f.speed * ((tMs - takeMs) / 1000)) / 3600
  if (f.total <= 0 || targetNm <= 0) return [f.lons[0]!, f.lats[0]!]
  if (targetNm >= f.total) return [f.lons[f.lons.length - 1]!, f.lats[f.lats.length - 1]!]
  let k = 1
  while (k < f.cum.length && f.cum[k]! < targetNm) k++
  const seg = f.cum[k]! - f.cum[k - 1]!
  const t = seg === 0 ? 0 : (targetNm - f.cum[k - 1]!) / seg
  return [
    f.lons[k - 1]! + (f.lons[k]! - f.lons[k - 1]!) * t,
    f.lats[k - 1]! + (f.lats[k]! - f.lats[k - 1]!) * t,
  ]
}

interface RegionTest {
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  inside: (lon: number, lat: number, alt: number) => boolean
}

function buildRegionTest(snap: SnapData, region: Region): RegionTest | { error: string } {
  if (region.kind === 'sector') {
    const band = region.ref.startsWith('HIGH') ? 'HIGH' : 'LOW'
    const poly = snap.pip[band].find(p => p.name === region.ref)
    if (!poly) return { error: `unknown sector ${region.ref}` }
    return {
      bbox: [poly.minLon, poly.minLat, poly.maxLon, poly.maxLat],
      inside: (lon, lat, alt) => assignSector(snap, lon, lat, alt) === region.ref,
    }
  }
  if (region.kind === 'circle') {
    if (!Number.isFinite(region.lat) || !Number.isFinite(region.lon) || !(region.radius_nm > 0)) {
      return { error: 'circle needs lat, lon, radius_nm' }
    }
    const dLat = region.radius_nm / 60
    const dLon = region.radius_nm / (60 * Math.max(0.2, Math.cos((region.lat * Math.PI) / 180)))
    return {
      bbox: [region.lon - dLon, region.lat - dLat, region.lon + dLon, region.lat + dLat],
      inside: (lon, lat) => haversineNm(lat, lon, region.lat, region.lon) <= region.radius_nm,
    }
  }
  // poly
  const coords = region.coords
  if (!Array.isArray(coords) || coords.length < 3) return { error: 'poly needs >= 3 coords' }
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const [lon, lat] of coords) {
    if (lon! < minLon) minLon = lon!; if (lon! > maxLon) maxLon = lon!
    if (lat! < minLat) minLat = lat!; if (lat! > maxLat) maxLat = lat!
  }
  return { bbox: [minLon, minLat, maxLon, maxLat], inside: (lon, lat) => pointInRing(lon, lat, coords) }
}

export interface EnteringFlight {
  fid: string
  eta: string
  exit_time: string
  entry_lat: number
  entry_lon: number
  alt: number
  origin: string
  dest: string
  minutes_to_entry: number
}

const BAND_BREAK_FT = 35000

export async function flightsEntering(
  snapshot: string,
  region: Region,
  nowMs: number,
  fromMs: number,
  toMs: number,
  altBand?: 'LOW' | 'HIGH' | null,
  stepSeconds = 60,
  delaysByFid?: Record<string, number> | null,
): Promise<{ flights: EnteringFlight[] } | { error: string }> {
  const snap = await getSnapData(snapshot)
  const table = await getFlightTable(snapshot)
  const rt = buildRegionTest(snap, region)
  if ('error' in rt) return rt

  const [rMinLon, rMinLat, rMaxLon, rMaxLat] = rt.bbox
  const stepMs = Math.max(15, stepSeconds) * 1000
  const results: EnteringFlight[] = []

  for (const f of table) {
    const dms = delaysByFid ? (delaysByFid[f.fid] ?? 0) * 60000 : 0
    const takeMs = f.takeMs + dms
    const landMs = f.landMs + dms
    if (landMs < fromMs || takeMs > toMs) continue
    if (f.maxLon < rMinLon || f.minLon > rMaxLon || f.maxLat < rMinLat || f.minLat > rMaxLat) continue
    if (altBand && (f.alt < BAND_BREAK_FT ? 'LOW' : 'HIGH') !== altBand) continue

    // Genuine entrant: outside at the window start, transitions inside during it.
    // Flights already inside at "now" are current occupants, not entering.
    let etaMs: number | null = null
    let entry: [number, number] | null = null
    let exitMs: number | null = null
    let prevInside: boolean | null = null
    for (let t = fromMs; t <= toMs; t += stepMs) {
      const pos = positionAt(f, t, takeMs, landMs)
      if (!pos) continue
      const isIn = rt.inside(pos[0], pos[1], f.alt)
      if (etaMs == null && prevInside === false && isIn) { etaMs = t; entry = pos }
      else if (etaMs != null && !isIn) { exitMs = t; break }
      prevInside = isIn
    }
    if (etaMs == null || !entry) continue
    results.push({
      fid: f.fid,
      eta: new Date(etaMs).toISOString(),
      exit_time: new Date(exitMs ?? toMs).toISOString(),
      entry_lat: entry[1],
      entry_lon: entry[0],
      alt: f.alt,
      origin: f.origin,
      dest: f.dest,
      minutes_to_entry: Math.round((etaMs - nowMs) / 60000),
    })
  }
  results.sort((a, b) => a.eta.localeCompare(b.eta))
  return { flights: results }
}
