import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Flight, FlightSearchItem, FlightWithSnapshot, RoutesSnapshot } from '~/types/flight'
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

export async function searchFlights(query: string, limit = 20): Promise<FlightSearchItem[]> {
  const data = await loadSnapshot()
  const q = query.trim().toUpperCase()
  if (!q) return []

  const matches: FlightSearchItem[] = []
  for (const flight of data.flights) {
    if (flight.flight_number.toUpperCase().includes(q)) {
      matches.push(toSearchItem(flight))
      if (matches.length >= limit) break
    }
  }
  return matches
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
