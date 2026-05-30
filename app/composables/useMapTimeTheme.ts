import type { FlightWithSnapshot } from '~/types/flight'
import { interpolatePosition } from '~/utils/interpolatePosition'
import { isMapDarkAt } from '~/utils/mapDayNight'

export function useMapTimeTheme(
  flight: Ref<FlightWithSnapshot | null>,
  currentTime: Ref<string>
) {
  return computed(() => {
    if (!flight.value || !currentTime.value) return false
    const { lat, lon } = interpolatePosition(flight.value, currentTime.value)
    return isMapDarkAt(currentTime.value, lat, lon)
  })
}
