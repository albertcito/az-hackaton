import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Alert, AlertKind, AlertRegion, AlertSeverity } from '~/types/alert'
import type { OpsSession } from './opsSession'
import { flightsEntering, type Region } from './opsLookahead'

function regionLabel(r: AlertRegion): string {
  if (r.kind === 'sector') return r.ref ?? 'sector'
  if (r.kind === 'circle') return `area @ ${r.lat?.toFixed(1)},${r.lon?.toFixed(1)} (${Math.round(r.radius_nm ?? 0)} nm)`
  return 'area'
}

function severityFor(kind: AlertKind, n: number): AlertSeverity {
  if (n === 0) return 'low'
  if (kind === 'closure' || kind === 'turbulence') return n >= 3 ? 'high' : 'med'
  return n >= 8 ? 'high' : 'med'
}

/** Raise a hazard over a region+window: run the lookahead and emit/refresh an Alert. */
export async function raiseHazard(
  session: OpsSession,
  region: Region,
  kind: AlertKind,
  fromIso: string,
  toIso: string,
  nowIso: string,
): Promise<Alert> {
  const nowMs = Date.parse(nowIso)
  const fromMs = Date.parse(fromIso)
  const toMs = Date.parse(toIso)
  const res = await flightsEntering(session.snapshot, region, nowMs, fromMs, toMs)
  const flights = 'flights' in res ? res.flights : []
  const affected = flights.map(f => ({
    fid: f.fid, eta: f.eta, minutes_to_entry: f.minutes_to_entry,
    origin: f.origin, dest: f.dest, alt: f.alt,
  }))
  const horizonMin = Math.round((toMs - fromMs) / 60000)
  const reg = region as AlertRegion

  const suggested = [{ type: 'advisory', label: 'draft advisory for these flights' }]
  if (region.kind === 'sector') suggested.push({ type: 'reroute', label: `reroute around ${region.ref}`, args: { sector: region.ref } } as any)

  // Dedupe: refresh an existing un-resolved hazard for the same region+kind.
  const key = JSON.stringify(reg) + kind
  const existing = session.alerts.find(
    a => a.type === 'hazard' && a.status !== 'resolved' && JSON.stringify(a.region) + a.kind === key,
  )
  const id = existing?.id ?? `al_${String(++session.alertSeq).padStart(3, '0')}`

  const alert: Alert = {
    id,
    type: 'hazard',
    kind,
    severity: severityFor(kind, affected.length),
    region: reg,
    window: { from: fromIso, to: toIso },
    message: `${affected.length} flight${affected.length === 1 ? '' : 's'} enter ${regionLabel(reg)} (${kind}) within ${horizonMin} min.`,
    affected,
    suggested_actions: suggested,
    status: existing ? existing.status : 'new',
    created_at: existing?.created_at ?? new Date().toISOString(),
    announced: existing?.announced,
  }

  if (existing) Object.assign(existing, alert)
  else session.alerts.push(alert)
  return existing ?? alert
}

export function listAlerts(session: OpsSession, status?: string): Alert[] {
  return status ? session.alerts.filter(a => a.status === status) : session.alerts
}

export function setAlertStatus(session: OpsSession, id: string, status: Alert['status']): Alert | undefined {
  const a = session.alerts.find(x => x.id === id)
  if (a) a.status = status
  return a
}

// ---- T2: convective penetration (auto-generated from the weather grids) ----

const BIN_MINUTES = 15
const penCache = new Map<string, Promise<{ pen: Record<string, number[]>, cells: Record<string, [number, string][]> }>>()

function loadPenData(snapshot: string) {
  let p = penCache.get(snapshot)
  if (!p) {
    p = (async () => {
      const read = async (n: string) => {
        try { return JSON.parse(await readFile(join(DERIVED_DIR, snapshot, n), 'utf-8')) } catch { return {} }
      }
      const [pen, cells] = await Promise.all([read('penetration.json'), read('flight_cells.json')])
      return { pen, cells }
    })()
    penCache.set(snapshot, p)
  }
  return p
}

/**
 * Refresh penetration alerts for the window [now, now+horizon]: group flights
 * that will penetrate convective weather by the sector they're in, one alert
 * per sector (stable id pen_<sector>). Stale penetration alerts are dropped.
 */
export async function scanPenetration(session: OpsSession, nowIso: string, horizonMin = 30): Promise<Alert[]> {
  const derived = await getDerived(session.snapshot)
  const bins: string[] = derived.demand.bins
  const { pen, cells } = await loadPenData(session.snapshot)

  const nowMs = Date.parse(nowIso)
  let nowBin = 0
  let best = Infinity
  bins.forEach((iso, i) => { const d = Math.abs(Date.parse(iso) - nowMs); if (d < best) { best = d; nowBin = i } })
  const maxBin = nowBin + Math.ceil(horizonMin / BIN_MINUTES)

  const groups = new Map<string, { fid: string, bin: number }[]>()
  for (const [fid, pbins] of Object.entries(pen)) {
    const nb = (pbins as number[]).find(b => b >= nowBin && b <= maxBin)
    if (nb == null) continue
    const cell = (cells[fid] as [number, string][] | undefined)?.find(x => x[0] === nb)
    const sector = cell?.[1]
    if (!sector) continue
    if (!groups.has(sector)) groups.set(sector, [])
    groups.get(sector)!.push({ fid, bin: nb })
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6)
  const keep = new Set<string>()

  for (const [sector, list] of sorted) {
    const basics = await getFlightsBasics(list.map(x => x.fid).slice(0, 30))
    const byFid = new Map(basics.map(b => [b.id, b]))
    const affected = list.slice(0, 30).map((x) => {
      const b = byFid.get(x.fid)
      const eta = bins[x.bin]!
      return {
        fid: x.fid, eta,
        minutes_to_entry: Math.round((Date.parse(eta) - nowMs) / 60000),
        origin: b?.origin_airport_icao ?? '', dest: b?.destination_airport_icao ?? '', alt: b?.cruise_altitude_ft ?? 0,
      }
    })
    const minLead = Math.min(...affected.map(a => a.minutes_to_entry))
    const severity: AlertSeverity = minLead <= 5 ? 'high' : minLead <= 12 ? 'med' : 'low'
    const id = `pen_${sector}`
    keep.add(id)
    const existing = session.alerts.find(a => a.id === id)
    const alert: Alert = {
      id, type: 'penetration', kind: 'convection', severity,
      region: { kind: 'sector', ref: sector },
      window: { from: nowIso, to: bins[Math.min(maxBin, bins.length - 1)]! },
      message: `${list.length} flight${list.length === 1 ? '' : 's'} penetrate convective weather in ${sector} within ${horizonMin} min.`,
      affected,
      suggested_actions: [
        { type: 'advisory', label: 'draft advisory for these flights' },
        { type: 'reroute', label: `reroute around ${sector}`, args: { sector } },
      ],
      status: existing ? existing.status : 'new',
      created_at: existing?.created_at ?? new Date().toISOString(),
      announced: existing?.announced,
    }
    if (existing) Object.assign(existing, alert)
    else session.alerts.push(alert)
  }

  // Drop penetration alerts no longer relevant in this window.
  session.alerts = session.alerts.filter(a => a.type !== 'penetration' || keep.has(a.id))
  return session.alerts
}
