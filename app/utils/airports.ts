import airports from '~/data/airports.json'
import type { AirportLocation, AirportMenuItem } from '~/types/airport'

const airportByIcao = airports as Record<string, AirportLocation>

export function getAirportLocation(icao: string): AirportLocation | undefined {
  return airportByIcao[icao.toUpperCase()]
}

export function formatAirportLabel(icao: string): string {
  const location = getAirportLocation(icao)
  if (!location) return icao
  return `${location.city}, ${location.state}`
}

/** Airport code + state, e.g. ORD, IL (derived from ICAO by dropping the leading K). */
export function formatAirportAbbrLabel(icao: string): string {
  const code = icao.toUpperCase()
  const abbr = code.startsWith('K') && code.length === 4 ? code.slice(1) : code
  const location = getAirportLocation(code)
  if (!location) return abbr
  return `${abbr}, ${location.state}`
}

export function toAirportMenuItem(icao: string): AirportMenuItem {
  const code = icao.toUpperCase()
  const location = getAirportLocation(code)

  return {
    icao: code,
    label: location ? `${location.city}, ${location.state}` : code,
    description: code
  }
}

export function toAirportMenuItems(icaos: string[]): AirportMenuItem[] {
  return icaos.map(toAirportMenuItem)
}
