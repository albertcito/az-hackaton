import type { FlightWithSnapshot } from '~/types/flight'
import type { SectorTraffic } from '~/types/sector'
import { buildFlightId } from '~/utils/flightId'

const THROTTLE_MS = 180

/**
 * Reactively fetches the other flights sharing the selected flight's sector at
 * the current time. Throttled so scrubbing/playback don't spam the server but
 * still refresh while time keeps moving, and request-id guarded so out-of-order
 * responses are discarded.
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
  let lastRefreshAt = 0

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
    if (!enabled.value || !flight.value) {
      if (timer) clearTimeout(timer)
      timer = null
      traffic.value = null
      loading.value = false
      return
    }

    const now = Date.now()
    const elapsed = now - lastRefreshAt

    if (elapsed >= THROTTLE_MS) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastRefreshAt = now
      refresh()
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null
        lastRefreshAt = Date.now()
        refresh()
      }, THROTTLE_MS - elapsed)
    }
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
