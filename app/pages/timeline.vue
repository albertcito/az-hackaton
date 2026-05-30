<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'
import type { FlightTimelineResponse } from '~/types/flight'
import { formatAirportLabel } from '~/utils/airports'
import { formatUtcDateTime, formatUtcTime } from '~/utils/formatFlight'

const timeline = ref<FlightTimelineResponse | null>(null)
const loading = ref(false)
const error = ref('')
const currentTime = ref('')
const selectedFlightId = ref<string | null>(null)
const selectedEventId = ref<string | number | undefined>(undefined)

const animationStart = computed(() => {
  const flights = timeline.value?.flights
  if (!flights?.length) return ''
  return flights.reduce(
    (earliest, flight) =>
      flight.take_off_time < earliest ? flight.take_off_time : earliest,
    flights[0]!.take_off_time
  )
})

const animationEnd = computed(() => {
  const flights = timeline.value?.flights
  if (!flights?.length) return ''
  return flights.reduce(
    (latest, flight) =>
      flight.scheduled_landing_time > latest ? flight.scheduled_landing_time : latest,
    flights[0]!.scheduled_landing_time
  )
})

const timelineItems = computed<TimelineItem[]>(() => {
  if (!timeline.value) return []

  return timeline.value.events.map((event) => {
    const route = `${event.origin_airport_icao} → ${event.destination_airport_icao}`
    const otherLabel = formatAirportLabel(event.other_airport_icao)
    const direction = event.type === 'departure'
      ? `Departure to ${otherLabel}`
      : `Arrival from ${otherLabel}`

    return {
      value: event.id,
      date: formatUtcTime(event.time),
      title: event.flight_number,
      description: `${direction} · ${route}`,
      icon: event.type === 'departure' ? 'i-lucide-plane-takeoff' : 'i-lucide-plane-landing'
    }
  })
})

const airportLabel = computed(() =>
  timeline.value ? formatAirportLabel(timeline.value.airport) : ''
)

const snapshotDay = computed(() => {
  if (!timeline.value) return ''
  return new Date(timeline.value.window_start).toISOString().slice(0, 10)
})

async function loadTimeline(airport: string) {
  loading.value = true
  error.value = ''
  selectedFlightId.value = null
  selectedEventId.value = undefined

  try {
    timeline.value = await $fetch<FlightTimelineResponse>('/api/flights/timeline', {
      query: { airport }
    })
    currentTime.value = timeline.value.asked_at
  } catch {
    timeline.value = null
    error.value = 'Could not load flights for that city.'
  } finally {
    loading.value = false
  }
}

function onTimelineSelect(_event: Event, item: TimelineItem) {
  if (!timeline.value) return
  const event = timeline.value.events.find((entry) => entry.id === item.value)
  if (!event) return

  selectedEventId.value = item.value
  selectedFlightId.value = event.flight_id
  currentTime.value = event.time
}

function onMapSelect(flightId: string) {
  selectedFlightId.value = flightId
  const event = timeline.value?.events.find((entry) => entry.flight_id === flightId)
  if (event) {
    selectedEventId.value = event.id
    currentTime.value = event.time
  }
}
</script>

<template>
  <div class="bg-default text-default flex h-screen flex-col">
    <header class="border-default bg-default z-20 shrink-0 border-b px-4 py-3">
      <div class="mx-auto flex max-w-7xl flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <h1 class="text-highlighted text-lg font-semibold">
              Airport Flight Timeline
            </h1>
            <UButton
              to="/"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-map"
            >
              Map
            </UButton>
          </div>
          <UColorModeButton />
        </div>
        <FlightTimelineForm @submit="loadTimeline" />
      </div>
    </header>

    <div v-if="loading" class="text-muted flex flex-1 items-center justify-center gap-2">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      Loading flights…
    </div>

    <UAlert
      v-else-if="error"
      class="m-4"
      color="error"
      icon="i-lucide-circle-alert"
      :title="error"
    />

    <div
      v-else-if="timeline"
      class="flex min-h-0 flex-1 flex-col lg:flex-row"
    >
      <div class="relative min-h-80 min-w-0 flex-1 lg:min-h-0">
        <FlightTimelineMap
          v-if="timeline.flights.length"
          :flights="timeline.flights"
          :airport="timeline.airport"
          :current-time="currentTime"
          :selected-flight-id="selectedFlightId"
          @select="onMapSelect"
        />
        <div
          v-else
          class="bg-muted flex h-full items-center justify-center text-sm"
        >
          No routes to display
        </div>
        <FlightDayTimeScrubber
          v-if="timeline.flights.length"
          v-model:current-time="currentTime"
          :start-iso="animationStart"
          :end-iso="animationEnd"
        />
      </div>

      <aside class="border-default flex w-full flex-col gap-4 overflow-y-auto border-t p-4 lg:w-96 lg:border-t-0 lg:border-l">
        <div class="flex flex-col gap-1">
          <h2 class="text-highlighted text-base font-medium">
            {{ airportLabel }} ({{ timeline.airport }})
          </h2>
          <p class="text-muted text-sm">
            {{ timeline.flights.length }} flights · {{ timeline.events.length }} events on {{ snapshotDay }}
            · snapshot {{ formatUtcDateTime(timeline.asked_at) }}
          </p>
        </div>

        <UAlert
          v-if="!timeline.events.length"
          color="neutral"
          icon="i-lucide-plane"
          title="No flights found"
          description="There are no departures or arrivals for this city in the current dataset."
        />

        <UTimeline
          v-else
          v-model="selectedEventId"
          :items="timelineItems"
          class="w-full"
          @select="onTimelineSelect"
        />
      </aside>
    </div>

    <div v-else class="text-muted flex flex-1 items-center justify-center p-8 text-sm">
      Choose a city and submit to see departures and arrivals for the day.
    </div>
  </div>
</template>
