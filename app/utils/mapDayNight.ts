import tzlookup from 'tz-lookup'

const NIGHT_START_HOUR = 18
const NIGHT_END_HOUR = 6

function localHour(isoUtc: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(new Date(isoUtc))

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return get('hour') + get('minute') / 60 + get('second') / 3600
}

function isNightHour(hour: number): boolean {
  return hour < NIGHT_END_HOUR || hour >= NIGHT_START_HOUR
}

function approximateLocalHour(isoUtc: string, lon: number): number {
  const utcHour = localHour(isoUtc, 'UTC')
  return (utcHour + lon / 15 + 24) % 24
}

export function isMapDarkAt(isoUtc: string, lat: number, lon: number): boolean {
  try {
    const timeZone = tzlookup(lat, lon)
    return isNightHour(localHour(isoUtc, timeZone))
  } catch {
    return isNightHour(approximateLocalHour(isoUtc, lon))
  }
}
