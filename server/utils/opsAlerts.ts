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
