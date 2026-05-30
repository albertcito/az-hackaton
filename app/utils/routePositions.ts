import type { Flight } from '~/types/flight'
import { feetToMeters } from '~/utils/interpolatePosition'

type Cartesian3Factory = (lon: number, lat: number, height: number) => unknown

export function toRoutePositions(flight: Flight, fromDegrees: Cartesian3Factory): unknown[] {
  const height = feetToMeters(flight.cruise_altitude_ft)
  return flight.lats.map((lat, i) => fromDegrees(flight.lons[i], lat, height))
}

export function toPosition(fromDegrees: Cartesian3Factory, lat: number, lon: number, altFt: number): unknown {
  return fromDegrees(lon, lat, feetToMeters(altFt))
}
