<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { formatRouteLabel } from '~/utils/formatFlight'

const props = defineProps<{
  flights: FlightWithSnapshot[]
}>()

const selectedFlightIds = defineModel<string[]>({ default: () => [] })

const flightItems = computed(() =>
  props.flights.map((flight) => ({
    id: buildFlightId(flight),
    label: formatRouteLabel(
      flight.flight_number,
      flight.origin_airport_icao,
      flight.destination_airport_icao,
      flight.take_off_time
    ),
    description: `${flight.origin_airport_icao} → ${flight.destination_airport_icao}`
  }))
)
</script>

<template>
  <UFormField label="Flights" class="min-w-72 flex-1">
    <UInputMenu
      v-model="selectedFlightIds"
      multiple
      value-key="id"
      :items="flightItems"
      :filter-fields="['label', 'id', 'description']"
      placeholder="All flights — select to filter map"
      icon="i-lucide-plane"
      open-on-focus
    />
  </UFormField>
</template>
