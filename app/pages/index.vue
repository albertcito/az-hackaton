<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { defaultFlightTime } from '~/utils/interpolatePosition'

const flight = ref<FlightWithSnapshot | null>(null)
const selectedFlight = ref<FlightWithSnapshot | null>(null)
const currentTime = ref('')
const showSectorTraffic = ref(false)

// Navigation history: a fresh search resets it to a single root; jumping to a
// flight from the sector panel pushes onto it. Back pops to the previous flight.
const history = ref<FlightWithSnapshot[]>([])
const canGoBack = computed(() => history.value.length > 1)
const previousFlight = computed(() =>
  canGoBack.value ? history.value[history.value.length - 2] : null
)

const { traffic: sectorTraffic, loading: sectorLoading } = useSectorTraffic(
  flight,
  currentTime,
  showSectorTraffic
)

async function fetchFlight(flightId: string): Promise<FlightWithSnapshot> {
  return $fetch<FlightWithSnapshot>(`/api/flights/${encodeURIComponent(flightId)}`)
}

function applyFlight(f: FlightWithSnapshot) {
  flight.value = f
  currentTime.value = defaultFlightTime(f, f.asked_at)
  selectedFlight.value = f
}

// Entry point from the search bar — starts a new navigation history.
async function loadFlight(flightId: string) {
  const f = await fetchFlight(flightId)
  history.value = [f]
  applyFlight(f)
}

// Entry point from the sector panel — pushes onto the history so Back works.
async function navigateToFlight(flightId: string) {
  if (flight.value && buildFlightId(flight.value) === flightId) return
  const f = await fetchFlight(flightId)
  history.value.push(f)
  applyFlight(f)
}

function goBack() {
  if (history.value.length <= 1) return
  history.value.pop()
  applyFlight(history.value[history.value.length - 1])
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
          <div class="flex items-center gap-3">
            <UButton
              v-if="canGoBack"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="soft"
              size="xs"
              @click="goBack"
            >
              Back to {{ previousFlight?.flight_number }}
            </UButton>
            <h1 class="text-highlighted text-lg font-semibold">
              4D Flight Visualization
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <USwitch
              v-model="showSectorTraffic"
              label="Sector traffic"
              :disabled="!flight"
            />
            <UColorModeButton />
          </div>
        </div>
        <FlightSearchForm :current="flight" @submit="loadFlight" />
      </div>
    </header>

    <main class="relative min-h-0 flex-1">
      <FlightRouteMap
        :flight="flight"
        :current-time="currentTime"
        :sector-traffic="sectorTraffic"
        :show-sector-traffic="showSectorTraffic"
        @select="showInfo"
      />
      <FlightInfoPanel
        v-if="selectedFlight"
        :flight="selectedFlight"
        @close="selectedFlight = null"
      />
      <SectorTrafficPanel
        v-if="showSectorTraffic && flight"
        :traffic="sectorTraffic"
        :loading="sectorLoading"
        @select="navigateToFlight"
      />
      <FlightTimeScrubber
        v-if="flight"
        v-model:current-time="currentTime"
        :flight="flight"
      />
    </main>
  </div>
</template>
