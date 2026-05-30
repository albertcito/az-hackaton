import type {
  BandFilter,
  ConsoleMode,
  DemandData,
  DemandSector,
  SnapshotMeta,
} from '~/types/demand'

// Shared, SSR-safe store for the ops console. All panels (map, timeline,
// hotspots, resolve toggle, assistant) read and mutate this single state.
export function useOpsStore() {
  const snapshots = useState<SnapshotMeta[]>('ops:snapshots', () => [])
  const snapshotId = useState<string | null>('ops:snapshotId', () => null)
  const askedAt = useState<string | null>('ops:askedAt', () => null)
  const demand = useState<DemandData | null>('ops:demand', () => null)
  const sectorsGeo = useState<any | null>('ops:sectorsGeo', () => null)
  const binIndex = useState<number>('ops:binIndex', () => 0)
  const band = useState<BandFilter>('ops:band', () => 'ALL')
  const mode = useState<ConsoleMode>('ops:mode', () => 'baseline')
  const selectedSector = useState<string | null>('ops:selectedSector', () => null)
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
    try {
      const [d, geo] = await Promise.all([
        $fetch<DemandData>(`/api/snapshot/${encodeURIComponent(id)}/demand`),
        sectorsGeo.value ? Promise.resolve(sectorsGeo.value) : $fetch('/api/sectors'),
      ])
      demand.value = d
      sectorsGeo.value = geo
      snapshotId.value = id
      askedAt.value = d.asked_at
      // Open on the most-stressed moment for immediate impact.
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

  return {
    // state
    snapshots, snapshotId, askedAt, demand, sectorsGeo,
    binIndex, band, mode, selectedSector, loading, error,
    // derived
    bins, nbins, currentBinIso, sectorMap, hotspots, peakStressBinIndex,
    // helpers
    countAt, formatBin,
    // actions
    loadDefault, loadSnapshot,
  }
}
