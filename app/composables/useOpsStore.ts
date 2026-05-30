import type {
  BandFilter,
  ConsoleMode,
  DemandData,
  DemandSector,
  MitigationData,
  SnapshotMeta,
} from '~/types/demand'

type MembersData = Record<string, Record<string, string[]>>

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
  const activeSeries = computed(() =>
    mode.value === 'mitigated' ? mitigatedSeries.value : baselineSeries.value,
  )
  const stressMax = computed(() =>
    Math.max(1, ...baselineSeries.value, ...mitigatedSeries.value),
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
      const first = res.snapshots[0]
      if (!first) {
        error.value = 'No snapshots materialized. Run scripts/materialize_data.py.'
        return
      }
      await loadSnapshot(first.id)
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
      const [d, geo, mem, mit] = await Promise.all([
        $fetch<DemandData>(`/api/snapshot/${encodeURIComponent(id)}/demand`),
        sectorsGeo.value ? Promise.resolve(sectorsGeo.value) : $fetch('/api/sectors'),
        $fetch<MembersData>(`/api/snapshot/${encodeURIComponent(id)}/members`).catch(() => ({})),
        $fetch<MitigationData>(`/api/snapshot/${encodeURIComponent(id)}/mitigation`).catch(() => null),
      ])
      demand.value = d
      sectorsGeo.value = geo
      members.value = mem
      mitigation.value = mit
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

  return {
    // state
    snapshots, snapshotId, askedAt, demand, sectorsGeo, members, mitigation,
    binIndex, band, mode, selectedSector, selectedFlightId, loading, error,
    // derived
    bins, nbins, currentBinIso, sectorMap, hotspots,
    baselineSeries, mitigatedSeries, activeSeries, stressMax, peakStressBinIndex,
    // helpers
    countAt, memberFids, formatBin,
    // actions
    loadDefault, loadSnapshot, selectSector,
  }
}
