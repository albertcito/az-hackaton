import type { FlightSearchItem } from '~/types/flight'

export function useFlightSearch() {
  const items = ref<FlightSearchItem[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function search(query: string) {
    if (timer) clearTimeout(timer)
    if (!query.trim()) {
      items.value = []
      return
    }

    timer = setTimeout(async () => {
      loading.value = true
      try {
        items.value = await $fetch<FlightSearchItem[]>('/api/flights/search', {
          query: { q: query }
        })
      } finally {
        loading.value = false
      }
    }, 250)
  }

  return { items, loading, search }
}
