export interface SectorInfo {
  name: string
  band: 'HIGH' | 'LOW'
  altitudeFromFt: number
  altitudeToFt: number
  capacity: number
  /** Exterior ring as [lon, lat] pairs, for drawing the sector boundary. */
  boundary: [number, number][]
}

export interface SectorFlightPosition {
  id: string
  flightNumber: string
  origin: string
  destination: string
  lat: number
  lon: number
  altFt: number
}

export interface SectorTraffic {
  /** Echoes the queried time so the client can ignore stale responses. */
  time: string
  /** Null when the flight is outside CONUS sector coverage at this time. */
  sector: SectorInfo | null
  /** Other flights in the same sector at this time (excludes the selected flight). */
  others: SectorFlightPosition[]
  /** Total flights in the sector, including the selected flight if it is active. */
  count: number
  capacity: number | null
  overDemand: boolean
}
