import type { WeatherImpact } from '~/types/weather'
import { REFC_CLEAR_THRESHOLD, REFC_NODATA } from '~/utils/weatherGrid'

export function formatDbz(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value)} dBZ`
}

export function reflectivityLabel(dbz: number | null): string {
  if (dbz === null) return 'No data'
  if (dbz < 0) return 'Clear'
  if (dbz < 20) return 'Light rain'
  if (dbz < 40) return 'Moderate rain'
  return 'Heavy rain'
}

export function formatEchoTop(ft: number | null): string {
  if (ft === null) return '—'
  return `${Math.round(ft).toLocaleString()} ft`
}

export function assessWeatherImpact(
  refcDbz: number | null,
  echoTopFt: number | null,
  altFt: number
): WeatherImpact {
  if (refcDbz === null) return { label: 'No data', color: 'neutral' }
  if (refcDbz <= REFC_NODATA || refcDbz < 0) return { label: 'Clear', color: 'success' }
  if (refcDbz < REFC_CLEAR_THRESHOLD) return { label: 'Below threshold', color: 'success' }
  if (echoTopFt !== null && echoTopFt > 0 && altFt > echoTopFt) {
    return { label: 'Above weather', color: 'success' }
  }
  if (refcDbz >= REFC_CLEAR_THRESHOLD) return { label: 'In precipitation', color: 'error' }
  return { label: 'Light precipitation', color: 'warning' }
}
