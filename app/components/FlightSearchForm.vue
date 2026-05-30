<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { toAirportMenuItems } from '~/utils/airports'

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

const originItems = computed(() => toAirportMenuItems(origins.value))
const destinationItems = computed(() => toAirportMenuItems(destinations.value))

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

function clearFilters() {
  syncingFromFlight.value = true
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
        :items="items"
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
