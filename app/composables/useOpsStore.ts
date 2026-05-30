import type {
  BandFilter,
  ConsoleMode,
  DemandData,
  DemandSector,
  MitigationData,
  SnapshotMeta,
} from '~/types/demand'
import type { Alert, AlertRegion } from '~/types/alert'

type MembersData = Record<string, Record<string, string[]>>
type AttributionData = Record<string, Record<string, { weather_displaced: number, n_total: number, n_weather: number }>>

// Shared, SSR-safe store for the ops console. All panels (map, timeline,
// hotspots, resolve toggle, assistant) read and mutate this single state.
export function useOpsStore() {
  const snapshots = useState<SnapshotMeta[]>('ops:snapshots', () => [])
  const snapshotId = useState<string | null>('ops:snapshotId', () => null)
  const askedAt = useState<string | null>('ops:askedAt', () => null)
  const demand = useState<DemandData | null>('ops:demand', () => null)
  const sectorsGeo = useState<any | null>('ops:sectorsGeo', () => null)
  const members = useState<MembersData | null>('ops:members', () => null)
  const mitigation = useState<MitigationData | null>('ops:mitigation', () => null)
  const attribution = useState<AttributionData | null>('ops:attribution', () => null)
  const showWeather = useState<boolean>('ops:showWeather', () => false)
  // Live state from the assistant's action tools (overrides baseline/mitigated).
  const liveCounts = useState<Record<string, number[]> | null>('ops:liveCounts', () => null)
  const liveStress = useState<number[] | null>('ops:liveStress', () => null)
  const liveSummary = useState<{ n_over_sectors: number, total_delay_minutes: number, n_actions: number } | null>('ops:liveSummary', () => null)
  // Session (shared by alerts + the assistant) and proactive alerting state.
  const sessionId = useState<string | null>('ops:sessionId', () => null)
  const alerts = useState<Alert[]>('ops:alerts', () => [])
  const hazardRegion = useState<AlertRegion | null>('ops:hazardRegion', () => null)
  const hazardAffectedFids = useState<string[]>('ops:hazardAffected', () => [])
  const placingCircle = useState<boolean>('ops:placingCircle', () => false)
  const hazardKind = useState<string>('ops:hazardKind', () => 'turbulence')
  const hazardHorizon = useState<number>('ops:hazardHorizon', () => 25)
  const binIndex = useState<number>('ops:binIndex', () => 0)
  const band = useState<BandFilter>('ops:band', () => 'ALL')
  const mode = useState<ConsoleMode>('ops:mode', () => 'baseline')
  const selectedSector = useState<string | null>('ops:selectedSector', () => null)
  const selectedFlightId = useState<string | null>('ops:selectedFlightId', () => null)
  const loading = useState<boolean>('ops:loading', () => false)
  const error = useState<string | null>('ops:error', () => null)

  const bins = computed(() => demand.value?.bins ?? [])
  const nbins = computed(() => bins.value.length)
  const currentBinIso = computed(() => bins.value[binIndex.value] ?? null)

  const sectorMap = computed(() => {
    const m = new Map<string, DemandSector>()
    for (const s of demand.value?.sectors ?? []) m.set(s.name, s)
    return m
  })

  function countAt(s: DemandSector, bi: number): number {
    if (mode.value === 'live') {
      const live = liveCounts.value?.[s.name]
      return (live ? live[bi] : s.counts[bi]) ?? 0
    }
    const arr = mode.value === 'mitigated' && s.counts_mitigated ? s.counts_mitigated : s.counts
    return arr[bi] ?? 0
  }

  /** Over-demand sectors at the current bin/mode/band, sorted by over-by desc. */
  const hotspots = computed(() => {
    const bi = binIndex.value
    return (demand.value?.sectors ?? [])
      .map(s => ({ sector: s, count: countAt(s, bi), over: countAt(s, bi) - s.capacity }))
      .filter(x => x.over > 0)
      .filter(x => band.value === 'ALL' || x.sector.band === band.value)
      .sort((a, b) => b.over - a.over)
  })

  // Network stress series per bin, for the timeline. Baseline comes straight
  // from demand.stress; mitigated is derived from counts_mitigated.
  const baselineSeries = computed<number[]>(() =>
    (demand.value?.stress ?? []).map(s => s.total_over),
  )
  const mitigatedSeries = computed<number[]>(() => {
    const d = demand.value
    if (!d) return []
    return d.bins.map((_, bi) =>
      d.sectors.reduce((acc, s) => {
        const c = (s.counts_mitigated ?? s.counts)[bi] ?? 0
        return acc + Math.max(0, c - s.capacity)
      }, 0),
    )
  })
  const activeSeries = computed(() => {
    if (mode.value === 'live' && liveStress.value) return liveStress.value
    return mode.value === 'mitigated' ? mitigatedSeries.value : baselineSeries.value
  })
  const stressMax = computed(() =>
    Math.max(1, ...baselineSeries.value, ...mitigatedSeries.value, ...(liveStress.value ?? [])),
  )

  const peakStressBinIndex = computed(() => {
    let best = -1
    let bi = 0
    for (const st of demand.value?.stress ?? []) {
      if (st.total_over > best) {
        best = st.total_over
        bi = st.bin_index
      }
    }
    return bi
  })

  /** Member fids for a sector at a bin (from members.json), or []. */
  function memberFids(sector: string, bi: number): string[] {
    return members.value?.[sector]?.[String(bi)] ?? []
  }

  /** Weather-displaced fraction for an over-demand (sector, bin), or null. */
  function weatherDisplaced(sector: string, bi: number): number | null {
    const v = attribution.value?.[sector]?.[String(bi)]
    return v ? v.weather_displaced : null
  }

  function formatBin(iso: string | null): string {
    if (!iso) return '--:--'
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`
  }

  async function loadDefault() {
    if (demand.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ snapshots: SnapshotMeta[] }>('/api/snapshots')
      snapshots.value = res.snapshots
      if (!res.snapshots.length) {
        error.value = 'No snapshots materialized. Run scripts/materialize_data.py.'
        return
      }
      // Prefer the configured demo snapshot (best weather<->congestion overlap).
      const preferred = useRuntimeConfig().public.demoSnapshot as string | undefined
      const pick = (preferred && res.snapshots.find(s => s.id === preferred)?.id) || res.snapshots[0]!.id
      await loadSnapshot(pick)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load snapshot'
    } finally {
      loading.value = false
    }
  }

  async function loadSnapshot(id: string) {
    loading.value = true
    error.value = null
    selectedSector.value = null
    selectedFlightId.value = null
    try {
      const [d, geo, mem, mit, attr] = await Promise.all([
        $fetch<DemandData>(`/api/snapshot/${encodeURIComponent(id)}/demand`),
        sectorsGeo.value ? Promise.resolve(sectorsGeo.value) : $fetch('/api/sectors'),
        $fetch<MembersData>(`/api/snapshot/${encodeURIComponent(id)}/members`).catch(() => ({})),
        $fetch<MitigationData>(`/api/snapshot/${encodeURIComponent(id)}/mitigation`).catch(() => null),
        $fetch<AttributionData>(`/api/snapshot/${encodeURIComponent(id)}/attribution`).catch(() => ({})),
      ])
      demand.value = d
      sectorsGeo.value = geo
      members.value = mem
      mitigation.value = mit
      attribution.value = attr
      snapshotId.value = id
      askedAt.value = d.asked_at
      binIndex.value = (() => {
        let best = -1, bi = 0
        for (const st of d.stress) if (st.total_over > best) { best = st.total_over; bi = st.bin_index }
        return bi
      })()
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load snapshot'
    } finally {
      loading.value = false
    }
  }

  function selectSector(name: string | null) {
    selectedSector.value = name
    selectedFlightId.value = null
  }

  /** Reset the console view to the baseline demo state (no server call). */
  function resetView() {
    selectedSector.value = null
    selectedFlightId.value = null
    liveCounts.value = null
    liveStress.value = null
    liveSummary.value = null
    mode.value = 'baseline'
    band.value = 'ALL'
    if (demand.value) binIndex.value = peakStressBinIndex.value
  }

  /** Merge a live state delta from the assistant's action tools. */
  function applyStateDelta(delta: any) {
    if (!delta) return
    const n = delta.summary?.n_actions ?? 0
    if (n === 0) {
      liveCounts.value = null
      liveStress.value = null
      liveSummary.value = null
      if (mode.value === 'live') mode.value = 'baseline'
      return
    }
    const merged: Record<string, number[]> = { ...(liveCounts.value ?? {}) }
    for (const [k, v] of Object.entries(delta.counts_now ?? {})) merged[k] = v as number[]
    liveCounts.value = merged
    liveStress.value = delta.stress_now ?? null
    liveSummary.value = delta.summary ?? null
    mode.value = 'live'
  }

  // ---- Session + proactive alerts ----

  const activeAlerts = computed(() => alerts.value.filter(a => a.status !== 'resolved'))

  async function ensureSession(): Promise<string | null> {
    if (sessionId.value) return sessionId.value
    try {
      const res = await $fetch<{ session_id: string }>('/api/session', { method: 'POST', body: { snapshot: snapshotId.value } })
      sessionId.value = res.session_id
    } catch { /* assistant/alerts unavailable */ }
    return sessionId.value
  }

  function isoPlus(iso: string, minutes: number): string {
    return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
  }

  function focusAlert(a: Alert) {
    hazardRegion.value = a.region
    hazardAffectedFids.value = a.affected.map(x => x.fid)
    const from = new Date(a.window.from).getTime()
    let bi = binIndex.value, best = Infinity
    bins.value.forEach((iso, i) => { const d = Math.abs(new Date(iso).getTime() - from); if (d < best) { best = d; bi = i } })
    binIndex.value = bi
  }

  function clearHazardOverlay() {
    hazardRegion.value = null
    hazardAffectedFids.value = []
  }

  async function raiseHazard(region: AlertRegion, kind: string, horizonMin = 25): Promise<Alert | null> {
    const sid = await ensureSession()
    if (!sid || !currentBinIso.value) return null
    const now = currentBinIso.value
    const res = await $fetch<{ alert: Alert, alerts: Alert[] }>(`/api/session/${sid}/hazard`, {
      method: 'POST',
      body: { region, kind, now, window: { from: now, to: isoPlus(now, horizonMin) } },
    })
    alerts.value = res.alerts
    placingCircle.value = false
    focusAlert(res.alert)
    return res.alert
  }

  async function loadAlerts(now?: string) {
    const sid = await ensureSession()
    if (!sid) return
    try {
      const q = now ? `?now=${encodeURIComponent(now)}` : ''
      const res = await $fetch<{ alerts: Alert[] }>(`/api/session/${sid}/alerts${q}`)
      alerts.value = res.alerts
    } catch { /* ignore */ }
  }

  async function ackAlert(id: string) {
    const sid = sessionId.value
    if (!sid) return
    const res = await $fetch<{ alerts: Alert[] }>(`/api/session/${sid}/alerts/${id}/ack`, { method: 'POST' })
    alerts.value = res.alerts
  }

  async function resolveAlert(id: string) {
    const sid = sessionId.value
    if (!sid) return
    const res = await $fetch<{ alerts: Alert[] }>(`/api/session/${sid}/alerts/${id}/resolve`, { method: 'POST' })
    alerts.value = res.alerts
    clearHazardOverlay()
  }

  /** Merge an alerts delta pushed from the assistant (PA4). */
  function applyAlertsDelta(next: Alert[]) {
    if (Array.isArray(next)) alerts.value = next
  }

  return {
    // state
    snapshots, snapshotId, askedAt, demand, sectorsGeo, members, mitigation, attribution, showWeather,
    liveCounts, liveStress, liveSummary,
    sessionId, alerts, hazardRegion, hazardAffectedFids, placingCircle, hazardKind, hazardHorizon,
    binIndex, band, mode, selectedSector, selectedFlightId, loading, error,
    // derived
    bins, nbins, currentBinIso, sectorMap, hotspots,
    baselineSeries, mitigatedSeries, activeSeries, stressMax, peakStressBinIndex, activeAlerts,
    // helpers
    countAt, memberFids, weatherDisplaced, formatBin,
    // actions
    loadDefault, loadSnapshot, selectSector, applyStateDelta, resetView,
    ensureSession, raiseHazard, loadAlerts, ackAlert, resolveAlert, focusAlert, clearHazardOverlay, applyAlertsDelta,
  }
}
