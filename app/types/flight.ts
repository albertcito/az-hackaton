export interface Flight {
  flight_number: string
  take_off_time: string
  scheduled_landing_time: string
  origin_airport_icao: string
  destination_airport_icao: string
  cruise_altitude_ft: number
  cruise_speed_kt: number
  lats: number[]
  lons: number[]
  is_airborne: boolean
}

export interface RoutesSnapshot {
  asked_at: string
  window_start: string
  window_end: string
  flights: Flight[]
}

export interface FlightSearchItem {
  id: string
  label: string
  description: string
  flight_number: string
  origin_airport_icao: string
  destination_airport_icao: string
  take_off_time: string
}

export interface FlightFilterOptions {
  origins: string[]
  destinations: string[]
  flights: FlightSearchItem[]
}

export interface FlightWithSnapshot extends Flight {
  asked_at: string
}

export interface LatLonAlt {
  lat: number
  lon: number
  altFt: number
}
