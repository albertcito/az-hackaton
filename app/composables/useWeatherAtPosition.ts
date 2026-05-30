import type { LatLonAlt } from '~/types/flight'
import type { WeatherSample } from '~/types/weather'
import { assessWeatherImpact } from '~/utils/formatWeather'
import { loadWeatherMatrix } from '~/utils/loadWeatherMatrix'
import {
  latLonToGridIndex,
  REFC_NODATA,
  RETOP_NODATA,
  sampleMatrix
} from '~/utils/weatherGrid'
import { weatherStripUrl } from '~/utils/weatherStrips'

const emptySample = (): WeatherSample => ({
  refcDbz: null,
  echoTopFt: null,
  loading: false,
  error: null
})

export function useWeatherAtPosition(
  askedAt: Ref<string>,
  timeIso: Ref<string>,
  position: Ref<LatLonAlt>,
  enabled: Ref<boolean>
) {
  const weather = ref<WeatherSample>(emptySample())
  let requestId = 0

  async function refresh() {
    if (!enabled.value) {
      weather.value = emptySample()
      return
    }

    const id = ++requestId
    weather.value = { ...weather.value, loading: true, error: null }

    try {
      const timeMs = new Date(timeIso.value).getTime()
      if (!Number.isFinite(timeMs)) throw new Error('Invalid time')

      const refcUrl = weatherStripUrl(askedAt.value, 'refc', timeMs)
      const retopUrl = weatherStripUrl(askedAt.value, 'retop', timeMs)
      const [refcMatrix, retopMatrix] = await Promise.all([
        loadWeatherMatrix(refcUrl),
        loadWeatherMatrix(retopUrl)
      ])

      if (id !== requestId) return

      const { row, col } = latLonToGridIndex(position.value.lat, position.value.lon)
      const refcRaw = sampleMatrix(refcMatrix, row, col)
      const retopRaw = sampleMatrix(retopMatrix, row, col)

      weather.value = {
        refcDbz: refcRaw <= REFC_NODATA ? null : refcRaw,
        echoTopFt: retopRaw < RETOP_NODATA ? null : retopRaw,
        loading: false,
        error: null
      }
    } catch {
      if (id !== requestId) return
      weather.value = {
        refcDbz: null,
        echoTopFt: null,
        loading: false,
        error: 'Unavailable'
      }
    }
  }

  watch(
    [askedAt, timeIso, () => position.value.lat, () => position.value.lon, enabled],
    refresh,
    { immediate: true }
  )

  const impact = computed(() =>
    assessWeatherImpact(weather.value.refcDbz, weather.value.echoTopFt, position.value.altFt)
  )

  return { weather, impact }
}
