import type { Flight, LatLonAlt } from '~/types/flight'

const FT_TO_M = 0.3048
const NM_PER_KT_PER_SEC = 1 / 3600
const EARTH_RADIUS_NM = 3440.065

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a))
}

function clampTime(timeMs: number, startMs: number, endMs: number): number {
  return Math.min(Math.max(timeMs, startMs), endMs)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function feetToMeters(ft: number): number {
  return ft * FT_TO_M
}

export function interpolatePosition(flight: Flight, isoTime: string): LatLonAlt {
  const startMs = new Date(flight.take_off_time).getTime()
  const endMs = new Date(flight.scheduled_landing_time).getTime()
  const timeMs = clampTime(new Date(isoTime).getTime(), startMs, endMs)

  if (timeMs <= startMs) {
    return { lat: flight.lats[0], lon: flight.lons[0], altFt: flight.cruise_altitude_ft }
  }
  if (timeMs >= endMs) {
    const last = flight.lats.length - 1
    return { lat: flight.lats[last], lon: flight.lons[last], altFt: flight.cruise_altitude_ft }
  }

  const elapsedSec = (timeMs - startMs) / 1000
  const targetNm = flight.cruise_speed_kt * elapsedSec * NM_PER_KT_PER_SEC
  let traveled = 0

  for (let i = 1; i < flight.lats.length; i++) {
    const segNm = haversineNm(flight.lats[i - 1], flight.lons[i - 1], flight.lats[i], flight.lons[i])
    if (traveled + segNm >= targetNm) {
      const t = segNm === 0 ? 0 : (targetNm - traveled) / segNm
      return {
        lat: lerp(flight.lats[i - 1], flight.lats[i], t),
        lon: lerp(flight.lons[i - 1], flight.lons[i], t),
        altFt: flight.cruise_altitude_ft
      }
    }
    traveled += segNm
  }

  const last = flight.lats.length - 1
  return { lat: flight.lats[last], lon: flight.lons[last], altFt: flight.cruise_altitude_ft }
}

export function defaultFlightTime(flight: Flight, askedAt: string): string {
  const startMs = new Date(flight.take_off_time).getTime()
  const endMs = new Date(flight.scheduled_landing_time).getTime()
  const askedMs = new Date(askedAt).getTime()
  if (askedMs >= startMs && askedMs <= endMs) return askedAt
  return flight.take_off_time
}
