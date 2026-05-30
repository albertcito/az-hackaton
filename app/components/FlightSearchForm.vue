<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { FlightSearchItem, FlightWithSnapshot } from '~/types/flight'
import { toAirportMenuItems } from '~/utils/airports'
import { buildFlightId } from '~/utils/flightId'
import { formatRouteLabel } from '~/utils/formatFlight'

const props = defineProps<{ current?: FlightWithSnapshot | null }>()
const emit = defineEmits<{ submit: [flightId: string] }>()

const schema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  flightId: z.string().min(1, 'Select a flight')
})

const state = reactive({
  origin: '',
  destination: '',
  flightId: ''
})

const searchTerm = ref('')
const syncingFromFlight = ref(false)
const { items, origins, destinations, loading, search, fetchOptions } = useFlightSearch()

// A flight selected outside the form (e.g. from the sector panel) may not be in
// the current search results, so we pin it as a menu item to keep it displayed.
const pinnedItem = ref<FlightSearchItem | null>(null)

const originItems = computed(() => toAirportMenuItems(origins.value))
const destinationItems = computed(() => toAirportMenuItems(destinations.value))

const flightItems = computed(() => {
  const pinned = pinnedItem.value
  if (!pinned || items.value.some((item) => item.id === pinned.id)) return items.value
  return [pinned, ...items.value]
})

function toSearchItem(flight: FlightWithSnapshot): FlightSearchItem {
  return {
    id: buildFlightId(flight),
    label: formatRouteLabel(
      flight.flight_number,
      flight.origin_airport_icao,
      flight.destination_airport_icao,
      flight.take_off_time
    ),
    description: `${flight.destination_airport_icao} · ${flight.cruise_altitude_ft.toLocaleString()} ft`,
    flight_number: flight.flight_number,
    origin_airport_icao: flight.origin_airport_icao,
    destination_airport_icao: flight.destination_airport_icao,
    take_off_time: flight.take_off_time
  }
}

const hasFilters = computed(() =>
  Boolean(state.origin || state.destination || state.flightId || searchTerm.value)
)

const canSubmit = computed(() => Boolean(state.flightId))

onMounted(() => fetchOptions({}))

watch(
  () => [state.origin, state.destination, searchTerm.value] as const,
  ([origin, destination, q]) => {
    if (syncingFromFlight.value) return
    search({ origin, destination, q })
  }
)

watch(
  () => state.origin,
  (origin, previous) => {
    if (syncingFromFlight.value || origin === previous) return
    state.destination = ''
    state.flightId = ''
  }
)

watch(
  () => state.destination,
  (destination, previous) => {
    if (syncingFromFlight.value || destination === previous) return
    state.flightId = ''
  }
)

watch(items, (flights) => {
  if (syncingFromFlight.value || state.flightId) return
  const [onlyFlight] = flights
  if (state.origin && state.destination && onlyFlight) {
    state.flightId = onlyFlight.id
  }
})

watch(
  () => state.flightId,
  async (flightId) => {
    if (!flightId) return
    const flight = items.value.find((item) => item.id === flightId)
    if (!flight) return
    if (flight.origin_airport_icao === state.origin && flight.destination_airport_icao === state.destination) {
      return
    }

    syncingFromFlight.value = true
    state.origin = flight.origin_airport_icao
    state.destination = flight.destination_airport_icao
    await nextTick()
    syncingFromFlight.value = false
  }
)

// Reflect an externally-selected flight (search result load, sector-panel jump,
// or Back) in the form fields without triggering the cascade-reset watchers.
watch(
  () => props.current,
  async (current) => {
    if (!current) return
    const id = buildFlightId(current)
    if (id === state.flightId) return

    syncingFromFlight.value = true
    pinnedItem.value = toSearchItem(current)
    state.origin = current.origin_airport_icao
    state.destination = current.destination_airport_icao
    state.flightId = id
    searchTerm.value = ''
    // Refresh the option lists for this flight's route so the destination menu
    // (scoped to the origin) shows the right value, not the previous search's.
    await fetchOptions({
      origin: current.origin_airport_icao,
      destination: current.destination_airport_icao
    })
    syncingFromFlight.value = false
  }
)

function clearFilters() {
  syncingFromFlight.value = true
  pinnedItem.value = null
  state.origin = ''
  state.destination = ''
  state.flightId = ''
  searchTerm.value = ''
  fetchOptions({})
  nextTick(() => {
    syncingFromFlight.value = false
  })
}

async function onSubmit(event: FormSubmitEvent<z.infer<typeof schema>>) {
  emit('submit', event.data.flightId)
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="flex flex-wrap items-end gap-3" @submit="onSubmit">
    <UFormField name="origin" label="Origin" class="min-w-40 flex-1">
      <UInputMenu
        v-model="state.origin"
        value-key="icao"
        :items="originItems"
        :filter-fields="['label', 'icao', 'description']"
        placeholder="Any origin"
        icon="i-lucide-plane-takeoff"
        :loading="loading && !originItems.length"
        open-on-focus
      />
    </UFormField>

    <UFormField name="destination" label="Destination" class="min-w-40 flex-1">
      <UInputMenu
        v-model="state.destination"
        value-key="icao"
        :items="destinationItems"
        :filter-fields="['label', 'icao', 'description']"
        placeholder="Any destination"
        icon="i-lucide-plane-landing"
        :disabled="!state.origin"
        :loading="loading && Boolean(state.origin)"
        open-on-focus
      />
    </UFormField>

    <UFormField name="flightId" label="Flight number" class="min-w-72 flex-1">
      <UInputMenu
        v-model="state.flightId"
        v-model:search-term="searchTerm"
        value-key="id"
        :items="flightItems"
        ignore-filter
        :loading="loading"
        icon="i-lucide-plane"
        placeholder="Search flight number (e.g. UAL2367)"
        open-on-focus
      />
    </UFormField>

    <UButton type="submit" icon="i-lucide-search" :disabled="!canSubmit">
      Track flight
    </UButton>

    <UButton
      v-if="hasFilters"
      type="button"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      aria-label="Clear search"
      @click="clearFilters"
    />
  </UForm>
</template>
