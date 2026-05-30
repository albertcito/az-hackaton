export function formatUtcTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16) + ' UTC'
}

export function formatUtcDateTime(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export function formatAltitude(ft: number): string {
  return `${ft.toLocaleString()} ft`
}

export function formatCoordinate(value: number, axis: 'lat' | 'lon'): string {
  const dir = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')
  return `${Math.abs(value).toFixed(4)}° ${dir}`
}

export function formatSpeed(kt: number): string {
  return `${kt} kt`
}

export function formatRouteLabel(
  flightNumber: string,
  origin: string,
  destination: string,
  takeOffTime: string
): string {
  return `${flightNumber} — ${origin} → ${destination} · ${formatUtcTime(takeOffTime)}`
}
