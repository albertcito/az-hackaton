import type { SectorFlightPosition, SectorTraffic } from '~/types/sector'
import { buildFlightId } from '~/utils/flightId'
import { interpolatePosition } from '~/utils/interpolatePosition'
import { findSector, pointInSector } from './sectorsCache'
import { getFlightById, getRoutesSnapshot } from './routesCache'

const EMPTY = (time: string): SectorTraffic => ({
  time,
  sector: null,
  others: [],
  count: 0,
  capacity: null,
  overDemand: false
})

/**
 * Find which sector the selected flight occupies at `isoTime`, then collect
 * every other flight that is airborne and inside that same sector at the same
 * moment. A flight is "in" a sector when it is active (between take-off and
 * landing), its cruise altitude falls in the sector's band, and its
 * interpolated position lies inside the sector polygon.
 */
export async function getSectorTraffic(id: string, isoTime: string): Promise<SectorTraffic> {
  const snapshot = await getRoutesSnapshot()
  const flight = getFlightById(id)
  if (!flight) return EMPTY(isoTime)

  const pos = interpolatePosition(flight, isoTime)
  const sector = await findSector(pos.lat, pos.lon, flight.cruise_altitude_ft)
  if (!sector) return EMPTY(isoTime)

  const tMs = new Date(isoTime).getTime()
  const others: SectorFlightPosition[] = []

  for (const candidate of snapshot.flights) {
    // Same altitude band as the sector (cheapest reject first).
    if (
      candidate.cruise_altitude_ft < sector.altitudeFromFt ||
      candidate.cruise_altitude_ft >= sector.altitudeToFt
    ) {
      continue
    }

    // Airborne at this instant.
    const takeMs = new Date(candidate.take_off_time).getTime()
    const landMs = new Date(candidate.scheduled_landing_time).getTime()
    if (tMs < takeMs || tMs >= landMs) continue

    const candidateId = buildFlightId(candidate)
    if (candidateId === id) continue

    const candidatePos = interpolatePosition(candidate, isoTime)
    if (!pointInSector(candidatePos.lat, candidatePos.lon, sector)) continue

    others.push({
      id: candidateId,
      flightNumber: candidate.flight_number,
      origin: candidate.origin_airport_icao,
      destination: candidate.destination_airport_icao,
      lat: candidatePos.lat,
      lon: candidatePos.lon,
      altFt: candidatePos.altFt
    })
  }

  others.sort((a, b) => a.flightNumber.localeCompare(b.flightNumber))

  const selectedActive =
    tMs >= new Date(flight.take_off_time).getTime() &&
    tMs < new Date(flight.scheduled_landing_time).getTime()
  const count = others.length + (selectedActive ? 1 : 0)

  return {
    time: isoTime,
    sector: {
      name: sector.name,
      band: sector.band,
      altitudeFromFt: sector.altitudeFromFt,
      altitudeToFt: sector.altitudeToFt,
      capacity: sector.capacity,
      boundary: sector.coordinates[0] as [number, number][]
    },
    others,
    count,
    capacity: sector.capacity,
    overDemand: count > sector.capacity
  }
}
