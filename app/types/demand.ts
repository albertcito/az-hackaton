export interface DemandSector {
  name: string
  band: 'LOW' | 'HIGH'
  capacity: number
  peak_count: number
  peak_bin_index: number
  over_by: number
  over_demand: boolean
  counts: number[]
  counts_mitigated?: number[]
}

export interface StressBin {
  bin_index: number
  total_over: number
  n_over_sectors: number
  total_flights: number
}

export interface DemandData {
  snapshot: string
  asked_at: string
  bin_minutes: number
  bins: string[]
  sectors: DemandSector[]
  stress: StressBin[]
}

export interface MitigationSummary {
  n_over_sectors: number
  total_over_area: number
  peak_stress: number
}

export interface MitigationAction {
  fid: string
  type: string
  minutes: number
  relieves: [string, number][]
}

export interface MitigationData {
  strategy: string
  baseline: MitigationSummary
  mitigated: MitigationSummary
  total_delay_minutes: number
  actions: MitigationAction[]
}

export interface SnapshotMeta {
  id: string
  asked_at: string
}

export type ConsoleMode = 'baseline' | 'mitigated'
export type BandFilter = 'ALL' | 'HIGH' | 'LOW'
