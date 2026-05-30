import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Flight,
  FlightFilterOptions,
  FlightSearchItem,
  FlightTimelineEvent,
  FlightTimelineResponse,
  FlightWithSnapshot,
  RoutesSnapshot
} from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { formatRouteLabel } from '~/utils/formatFlight'

let snapshot: RoutesSnapshot | null = null
let flightMap = new Map<string, Flight>()

async function loadSnapshot(): Promise<RoutesSnapshot> {
  if (snapshot) return snapshot

  const config = useRuntimeConfig()
  const filePath = join(process.cwd(), 'public', config.routesSnapshotDir, 'routes.json')
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

export async function getTimelineAirports(): Promise<string[]> {
  const data = await loadSnapshot()
  const airports = new Set<string>()

  for (const flight of data.flights) {
    airports.add(flight.origin_airport_icao)
    airports.add(flight.destination_airport_icao)
  }

  return [...airports].sort()
}

export async function getAirportTimeline(airport: string): Promise<FlightTimelineResponse | null> {
  const icao = airport.trim().toUpperCase()
  if (!icao) return null

  const data = await loadSnapshot()
  const events: FlightTimelineEvent[] = []
  const flights: FlightWithSnapshot[] = []
  const seen = new Set<string>()

  for (const flight of data.flights) {
    const involvesAirport =
      flight.origin_airport_icao === icao || flight.destination_airport_icao === icao
    if (!involvesAirport) continue

    const flightId = buildFlightId(flight)
    if (!seen.has(flightId)) {
      seen.add(flightId)
      flights.push({ ...flight, asked_at: data.asked_at })
    }

    if (flight.origin_airport_icao === icao) {
      events.push({
        id: `${flightId}|departure`,
        flight_id: flightId,
        time: flight.take_off_time,
        type: 'departure',
        flight_number: flight.flight_number,
        origin_airport_icao: flight.origin_airport_icao,
        destination_airport_icao: flight.destination_airport_icao,
        other_airport_icao: flight.destination_airport_icao,
        is_airborne: flight.is_airborne
      })
    }

    if (flight.destination_airport_icao === icao) {
      events.push({
        id: `${flightId}|arrival`,
        flight_id: flightId,
        time: flight.scheduled_landing_time,
        type: 'arrival',
        flight_number: flight.flight_number,
        origin_airport_icao: flight.origin_airport_icao,
        destination_airport_icao: flight.destination_airport_icao,
        other_airport_icao: flight.origin_airport_icao,
        is_airborne: flight.is_airborne
      })
    }
  }

  flights.sort((a, b) => new Date(a.take_off_time).getTime() - new Date(b.take_off_time).getTime())
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return {
    asked_at: data.asked_at,
    window_start: data.window_start,
    window_end: data.window_end,
    airport: icao,
    flights,
    events
  }
}
