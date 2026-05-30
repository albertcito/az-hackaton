export type AlertKind = 'turbulence' | 'convection' | 'closure' | 'overdemand'
export type AlertType = 'hazard' | 'penetration' | 'capacity'
export type AlertSeverity = 'low' | 'med' | 'high'
export type AlertStatus = 'new' | 'ack' | 'resolved'

export interface AlertRegion {
  kind: 'sector' | 'circle' | 'poly'
  ref?: string
  lat?: number
  lon?: number
  radius_nm?: number
  coords?: number[][]
}

export interface AlertAffected {
  fid: string
  eta: string
  minutes_to_entry: number
  origin: string
  dest: string
  alt: number
}

export interface AlertAction {
  type: string
  label: string
  args?: Record<string, any>
}

export interface Alert {
  id: string
  type: AlertType
  kind: AlertKind
  severity: AlertSeverity
  region: AlertRegion
  window: { from: string, to: string }
  message: string
  affected: AlertAffected[]
  suggested_actions: AlertAction[]
  status: AlertStatus
  created_at: string
  announced?: boolean // set once the assistant has proactively surfaced it
}
