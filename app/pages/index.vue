<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { defaultFlightTime } from '~/utils/interpolatePosition'

const flight = ref<FlightWithSnapshot | null>(null)
const selectedFlight = ref<FlightWithSnapshot | null>(null)
const currentTime = ref('')
const playRequest = ref(0)

async function loadFlight(flightId: string) {
  flight.value = await $fetch<FlightWithSnapshot>(`/api/flights/${encodeURIComponent(flightId)}`)
  currentTime.value = defaultFlightTime(flight.value, flight.value.asked_at)
  selectedFlight.value = flight.value
  playRequest.value++
}

function showInfo(f: FlightWithSnapshot) {
  selectedFlight.value = f
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-default border-b px-4 py-3">
      <div class="mx-auto max-w-7xl">
        <FlightSearchForm @submit="loadFlight" />
      </div>
    </div>

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
        :play-request="playRequest"
      />
    </main>
  </div>
</template>
