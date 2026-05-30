import type { FlightWithSnapshot } from '~/types/flight'
import type { SectorTraffic } from '~/types/sector'
import { buildFlightId } from '~/utils/flightId'

const DEBOUNCE_MS = 180

/**
 * Reactively fetches the other flights sharing the selected flight's sector at
 * the current time. Debounced so scrubbing/playback doesn't spam the server,
 * and request-id guarded so out-of-order responses are discarded.
 */
export function useSectorTraffic(
  flight: Ref<FlightWithSnapshot | null>,
  currentTime: Ref<string>,
  enabled: Ref<boolean>
) {
  const traffic = ref<SectorTraffic | null>(null)
  const loading = ref(false)
  let requestId = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function refresh() {
    if (!enabled.value || !flight.value || !currentTime.value) {
      traffic.value = null
      loading.value = false
      return
    }

    const id = ++requestId
    loading.value = true
    try {
      const data = await $fetch<SectorTraffic>('/api/sector-traffic', {
        query: { id: buildFlightId(flight.value), time: currentTime.value }
      })
      if (id !== requestId) return
      traffic.value = data
    } catch {
      if (id !== requestId) return
      traffic.value = null
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    if (!enabled.value || !flight.value) {
      traffic.value = null
      loading.value = false
      return
    }
    timer = setTimeout(refresh, DEBOUNCE_MS)
  }

  watch(
    [() => (flight.value ? buildFlightId(flight.value) : null), currentTime, enabled],
    schedule,
    { immediate: true }
  )

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { traffic, loading }
}
