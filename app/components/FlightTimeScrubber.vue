<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { defaultFlightTime } from '~/utils/interpolatePosition'
import { formatUtcDateTime, formatUtcTime } from '~/utils/formatFlight'

const props = defineProps<{ flight: FlightWithSnapshot }>()
const currentTime = defineModel<string>('currentTime', { required: true })

const startMs = computed(() => new Date(props.flight.take_off_time).getTime())
const endMs = computed(() => new Date(props.flight.scheduled_landing_time).getTime())
const sliderValue = computed({
  get: () => new Date(currentTime.value).getTime(),
  set: (ms: number) => { currentTime.value = new Date(ms).toISOString() }
})

const startIso = computed(() => props.flight.take_off_time)
const endIso = computed(() => props.flight.scheduled_landing_time)
const { playing, play, pause } = useFlightAnimation(startIso, endIso, currentTime)

watch(
  () => props.flight,
  (flight) => {
    pause()
    currentTime.value = defaultFlightTime(flight, flight.asked_at)
  },
  { immediate: true }
)

function togglePlay() {
  if (playing.value) pause()
  else play()
}
</script>

<template>
  <div class="border-default bg-default/95 absolute right-0 bottom-0 left-0 z-10 border-t p-4 backdrop-blur">
    <div class="mx-auto flex max-w-4xl flex-col gap-3">
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="text-muted">{{ formatUtcTime(flight.take_off_time) }}</span>
        <span class="font-medium">{{ formatUtcDateTime(currentTime) }}</span>
        <span class="text-muted">{{ formatUtcTime(flight.scheduled_landing_time) }}</span>
      </div>
      <USlider v-model="sliderValue" :min="startMs" :max="endMs" :step="1000" />
      <div class="flex justify-center">
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          color="primary"
          variant="soft"
          @click="togglePlay"
        >
          {{ playing ? 'Pause' : 'Play' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
