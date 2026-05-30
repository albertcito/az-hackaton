<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { defaultFlightTime } from '~/utils/interpolatePosition'

const flight = ref<FlightWithSnapshot | null>(null)
const selectedFlight = ref<FlightWithSnapshot | null>(null)
const currentTime = ref('')

async function loadFlight(flightId: string) {
  flight.value = await $fetch<FlightWithSnapshot>(`/api/flights/${encodeURIComponent(flightId)}`)
  currentTime.value = defaultFlightTime(flight.value, flight.value.asked_at)
  selectedFlight.value = flight.value
}

function showInfo(f: FlightWithSnapshot) {
  selectedFlight.value = f
}
</script>

<template>
  <div class="bg-default text-default flex h-screen flex-col">
    <header class="border-default bg-default z-20 border-b px-4 py-3">
      <div class="mx-auto flex max-w-6xl flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <h1 class="text-highlighted text-lg font-semibold">
            4D Flight Visualization
          </h1>
          <UColorModeButton />
        </div>
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
