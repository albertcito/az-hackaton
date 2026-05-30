import type { Flight } from '~/types/flight'

const SEP = '|'

export function buildFlightId(flight: Pick<Flight, 'flight_number' | 'take_off_time' | 'origin_airport_icao'>): string {
  return `${flight.flight_number}${SEP}${flight.take_off_time}${SEP}${flight.origin_airport_icao}`
}

export function parseFlightId(id: string): Pick<Flight, 'flight_number' | 'take_off_time' | 'origin_airport_icao'> {
  const [flight_number, take_off_time, origin_airport_icao] = id.split(SEP)
  return { flight_number, take_off_time, origin_airport_icao }
}
