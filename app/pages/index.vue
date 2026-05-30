<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { defaultFlightTime } from '~/utils/interpolatePosition'

const flight = ref<FlightWithSnapshot | null>(null)
const selectedFlight = ref<FlightWithSnapshot | null>(null)
const currentTime = ref('')

async function loadFlight(flightId: string) {
  selectedFlight.value = null
  flight.value = await $fetch<FlightWithSnapshot>(`/api/flights/${encodeURIComponent(flightId)}`)
  currentTime.value = defaultFlightTime(flight.value, flight.value.asked_at)
}

function showInfo(f: FlightWithSnapshot) {
  selectedFlight.value = f
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="border-default bg-default z-20 border-b px-4 py-3">
      <div class="mx-auto flex max-w-6xl flex-col gap-2">
        <h1 class="text-lg font-semibold">
          4D Flight Visualization
        </h1>
        <FlightSearchForm @submit="loadFlight" />
      </div>
    </header>

    <main class="relative min-h-0 flex-1">
      <FlightRouteMap
        :flight="flight"
        :current-time="currentTime"
        @select="showInfo"
      />
      <FlightInfoPanel
        v-if="selectedFlight"
        :flight="selectedFlight"
        @close="selectedFlight = null"
      />
      <FlightTimeScrubber
        v-if="flight"
        v-model:current-time="currentTime"
        :flight="flight"
      />
    </main>
  </div>
</template>
