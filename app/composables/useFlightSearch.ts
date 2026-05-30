import type { FlightFilterOptions, FlightSearchItem } from '~/types/flight'

export function useFlightSearch() {
  const items = ref<FlightSearchItem[]>([])
  const origins = ref<string[]>([])
  const destinations = ref<string[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function fetchOptions(filters: {
    origin?: string
    destination?: string
    q?: string
  }) {
    loading.value = true
    try {
      const data = await $fetch<FlightFilterOptions>('/api/flights/search', {
        query: {
          options: '1',
          origin: filters.origin || undefined,
          destination: filters.destination || undefined,
          q: filters.q || undefined
        }
      })
      origins.value = data.origins
      destinations.value = data.destinations
      items.value = data.flights
    } finally {
      loading.value = false
    }
  }

  function search(filters: {
    origin?: string
    destination?: string
    q?: string
  }) {
    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      fetchOptions(filters)
    }, 250)
  }

  return { items, origins, destinations, loading, search, fetchOptions }
}
