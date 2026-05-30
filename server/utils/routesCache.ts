import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Flight, FlightFilterOptions, FlightSearchItem, FlightWithSnapshot, RoutesSnapshot } from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { formatRouteLabel } from '~/utils/formatFlight'
import { sanitizeSnapshotId } from '~/utils/snapshotId'

let snapshot: RoutesSnapshot | null = null
let flightMap = new Map<string, Flight>()

async function loadSnapshot(): Promise<RoutesSnapshot> {
  if (snapshot) return snapshot

  const config = useRuntimeConfig()
  // Data lives in the gitignored, colon-free data/ dir (materialize_data.py),
  // not public/ — Windows can't hold the colon-bearing snapshot dir names.
  const filePath = join(process.cwd(), 'data', sanitizeSnapshotId(config.routesSnapshotDir), 'routes.json')
  const raw = await readFile(filePath, 'utf-8')
  snapshot = JSON.parse(raw) as RoutesSnapshot

  flightMap = new Map(
    snapshot.flights.map((flight) => [buildFlightId(flight), flight])
  )

  return snapshot
}

function toSearchItem(flight: Flight): FlightSearchItem {
  return {
    id: buildFlightId(flight),
    label: formatRouteLabel(
      flight.flight_number,
      flight.origin_airport_icao,
      flight.destination_airport_icao,
      flight.take_off_time
    ),
    description: `${flight.destination_airport_icao} · ${flight.cruise_altitude_ft.toLocaleString()} ft`,
    flight_number: flight.flight_number,
    origin_airport_icao: flight.origin_airport_icao,
    destination_airport_icao: flight.destination_airport_icao,
    take_off_time: flight.take_off_time
  }
}

function filterFlights(
  flights: Flight[],
  filters: { origin?: string, destination?: string, q?: string }
): Flight[] {
  const origin = filters.origin?.trim().toUpperCase()
  const destination = filters.destination?.trim().toUpperCase()
  const q = filters.q?.trim().toUpperCase()

  return flights.filter((flight) => {
    if (origin && flight.origin_airport_icao !== origin) return false
    if (destination && flight.destination_airport_icao !== destination) return false
    if (q && !flight.flight_number.toUpperCase().includes(q)) return false
    return true
  })
}

export async function getFlightFilterOptions(
  filters: { origin?: string, destination?: string, q?: string } = {},
  limit = 50
): Promise<FlightFilterOptions> {
  const data = await loadSnapshot()
  const origin = filters.origin?.trim().toUpperCase()

  const origins = [...new Set(data.flights.map((flight) => flight.origin_airport_icao))].sort()

  const routeFlights = origin
    ? data.flights.filter((flight) => flight.origin_airport_icao === origin)
    : data.flights
  const destinations = [...new Set(routeFlights.map((flight) => flight.destination_airport_icao))].sort()

  const flights = (() => {
    const hasRoute = Boolean(origin && filters.destination?.trim())
    const hasQuery = Boolean(filters.q?.trim())
    if (!hasRoute && !hasQuery) return []
    return filterFlights(data.flights, filters).slice(0, limit).map(toSearchItem)
  })()

  return { origins, destinations, flights }
}

export async function searchFlights(
  query: string,
  filters: { origin?: string, destination?: string } = {},
  limit = 20
): Promise<FlightSearchItem[]> {
  const { flights } = await getFlightFilterOptions({ ...filters, q: query }, limit)
  return flights
}

export async function getFlight(id: string): Promise<FlightWithSnapshot | null> {
  const data = await loadSnapshot()
  const flight = flightMap.get(id)
  if (!flight) return null
  return { ...flight, asked_at: data.asked_at }
}

export async function getSnapshotMeta(): Promise<Pick<RoutesSnapshot, 'asked_at'>> {
  const data = await loadSnapshot()
  return { asked_at: data.asked_at }
}

/** All flights in the configured snapshot (for the lookahead flight table). */
export async function getAllFlights(): Promise<Flight[]> {
  const data = await loadSnapshot()
  return data.flights
}

export interface FlightBasics {
  id: string
  flight_number: string
  origin_airport_icao: string
  destination_airport_icao: string
  cruise_altitude_ft: number
  cruise_speed_kt: number
  take_off_time: string
}

/** Compact basics for a list of flight ids (for hotspot drill-down rows). */
export async function getFlightsBasics(ids: string[]): Promise<FlightBasics[]> {
  await loadSnapshot()
  const out: FlightBasics[] = []
  for (const id of ids) {
    const f = flightMap.get(id)
    if (!f) continue
    out.push({
      id,
      flight_number: f.flight_number,
      origin_airport_icao: f.origin_airport_icao,
      destination_airport_icao: f.destination_airport_icao,
      cruise_altitude_ft: f.cruise_altitude_ft,
      cruise_speed_kt: f.cruise_speed_kt,
      take_off_time: f.take_off_time,
    })
  }
  return out
}
