<script setup lang="ts">
import type { FlightWithSnapshot } from '~/types/flight'
import { defaultFlightTime, interpolatePosition } from '~/utils/interpolatePosition'
import {
  formatAltitude,
  formatCoordinate,
  formatUtcDateTime,
  formatUtcTime
} from '~/utils/formatFlight'
import {
  formatDbz,
  formatEchoTop,
  reflectivityLabel
} from '~/utils/formatWeather'

const props = defineProps<{ flight: FlightWithSnapshot }>()
const currentTime = defineModel<string>('currentTime', { required: true })

const startMs = computed(() => new Date(props.flight.take_off_time).getTime())
const endMs = computed(() => new Date(props.flight.scheduled_landing_time).getTime())
const sliderMs = ref(0)
const scrubbing = ref(false)
const hovering = ref(false)

function clampMs(ms: number): number {
  return Math.min(Math.max(ms, startMs.value), endMs.value)
}

function msToIso(ms: number): string {
  return new Date(clampMs(ms)).toISOString()
}

function syncSliderFromCurrentTime() {
  const ms = new Date(currentTime.value).getTime()
  sliderMs.value = Number.isFinite(ms) ? clampMs(ms) : startMs.value
}

const startIso = computed(() => props.flight.take_off_time)
const endIso = computed(() => props.flight.scheduled_landing_time)
const { playing, play, pause } = useFlightAnimation(startIso, endIso, currentTime)

watch(
  () => props.flight,
  (flight) => {
    pause()
    currentTime.value = defaultFlightTime(flight, flight.asked_at)
    syncSliderFromCurrentTime()
  },
  { immediate: true }
)

watch(sliderMs, (ms) => {
  if (!Number.isFinite(ms)) return
  const iso = msToIso(ms)
  if (iso !== currentTime.value) currentTime.value = iso
})

watch(currentTime, () => {
  const ms = new Date(currentTime.value).getTime()
  if (!Number.isFinite(ms)) return
  const clamped = clampMs(ms)
  if (clamped !== sliderMs.value) sliderMs.value = clamped
})

function togglePlay() {
  if (playing.value) pause()
  else play()
}

const thumbPercent = computed(() => {
  const span = endMs.value - startMs.value
  if (span <= 0) return 0
  return ((sliderMs.value - startMs.value) / span) * 100
})

const sliderTimeIso = computed(() => msToIso(sliderMs.value))

const positionAtSlider = computed(() =>
  interpolatePosition(props.flight, sliderTimeIso.value)
)

const showThumbPopover = computed(() => hovering.value || scrubbing.value)

const askedAt = computed(() => props.flight.asked_at)
const { weather, impact } = useWeatherAtPosition(
  askedAt,
  sliderTimeIso,
  positionAtSlider,
  showThumbPopover
)

function onScrubStart() {
  scrubbing.value = true
}

function onScrubEnd() {
  scrubbing.value = false
}

onMounted(() => window.addEventListener('pointerup', onScrubEnd))
onUnmounted(() => window.removeEventListener('pointerup', onScrubEnd))
</script>

<template>
  <div class="border-default bg-default/95 absolute right-0 bottom-0 left-0 z-10 border-t p-4 backdrop-blur">
    <div class="mx-auto flex max-w-4xl flex-col gap-3">
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="text-muted">{{ formatUtcTime(flight.take_off_time) }}</span>
        <span class="font-medium">{{ formatUtcDateTime(currentTime) }}</span>
        <span class="text-muted">{{ formatUtcTime(flight.scheduled_landing_time) }}</span>
      </div>
      <div
        class="relative py-1"
        @pointerenter="hovering = true"
        @pointerleave="hovering = false"
        @pointerdown="onScrubStart"
      >
        <div
          class="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${thumbPercent}%` }"
        >
          <UPopover
            :open="showThumbPopover"
            arrow
            :content="{ side: 'top', sideOffset: 10, align: 'center' }"
          >
            <div class="size-4" aria-hidden="true" />
            <template #content>
              <div class="px-3 py-2 text-xs">
                <p class="text-muted font-medium">
                  {{ formatUtcDateTime(sliderTimeIso) }}
                </p>
                <dl class="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt class="text-muted">
                    Lat
                  </dt>
                  <dd class="font-medium tabular-nums">
                    {{ formatCoordinate(positionAtSlider.lat, 'lat') }}
                  </dd>
                  <dt class="text-muted">
                    Lon
                  </dt>
                  <dd class="font-medium tabular-nums">
                    {{ formatCoordinate(positionAtSlider.lon, 'lon') }}
                  </dd>
                  <dt class="text-muted">
                    Cruise alt
                  </dt>
                  <dd class="font-medium tabular-nums">
                    {{ formatAltitude(positionAtSlider.altFt) }}
                  </dd>
                </dl>
                <div class="border-default mt-2 border-t pt-2">
                  <p class="text-muted font-medium">
                    Weather
                  </p>
                  <dl
                    v-if="weather.loading"
                    class="mt-1.5 text-muted"
                  >
                    Loading…
                  </dl>
                  <dl
                    v-else-if="weather.error"
                    class="mt-1.5 text-muted"
                  >
                    {{ weather.error }}
                  </dl>
                  <dl
                    v-else
                    class="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
                  >
                    <dt class="text-muted">
                      Reflectivity
                    </dt>
                    <dd class="font-medium tabular-nums">
                      {{ formatDbz(weather.refcDbz) }}
                      <span
                        v-if="weather.refcDbz !== null"
                        class="text-muted font-normal"
                      >
                        · {{ reflectivityLabel(weather.refcDbz) }}
                      </span>
                    </dd>
                    <dt class="text-muted">
                      Echo top
                    </dt>
                    <dd class="font-medium tabular-nums">
                      {{ formatEchoTop(weather.echoTopFt) }}
                    </dd>
                    <dt class="text-muted">
                      Impact
                    </dt>
                    <dd>
                      <UBadge
                        :color="impact.color"
                        variant="subtle"
                        size="xs"
                      >
                        {{ impact.label }}
                      </UBadge>
                    </dd>
                  </dl>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
        <USlider
          v-model="sliderMs"
          :min="startMs"
          :max="endMs"
          :step="1000"
        />
      </div>
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
