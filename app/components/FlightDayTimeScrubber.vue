<script setup lang="ts">
import { formatUtcDateTime, formatUtcTime } from '~/utils/formatFlight'

const props = defineProps<{
  viewStartMs: number
  viewEndMs: number
  isZoomed: boolean
  playRequest?: number
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  resetZoom: []
  wheel: [event: WheelEvent]
}>()

const currentTime = defineModel<string>('currentTime', { required: true })

const sliderMs = ref(0)

function clampMs(ms: number): number {
  return Math.min(Math.max(ms, props.viewStartMs), props.viewEndMs)
}

function msToIso(ms: number): string {
  return new Date(clampMs(ms)).toISOString()
}

function syncSliderFromCurrentTime() {
  const ms = new Date(currentTime.value).getTime()
  sliderMs.value = Number.isFinite(ms) ? clampMs(ms) : props.viewStartMs
}

const startIsoRef = computed(() => new Date(props.viewStartMs).toISOString())
const endIsoRef = computed(() => new Date(props.viewEndMs).toISOString())
const { playing, play, pause } = useFlightAnimation(startIsoRef, endIsoRef, currentTime)

watch(
  () => [props.viewStartMs, props.viewEndMs] as const,
  () => syncSliderFromCurrentTime(),
  { immediate: true }
)

watch(
  () => props.playRequest,
  (request) => {
    if (request) nextTick(() => play())
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

function onWheel(event: WheelEvent) {
  emit('wheel', event)
}
</script>

<template>
  <div
    class="border-default bg-default/95 absolute right-0 bottom-0 left-0 z-10 border-t p-3 backdrop-blur"
    @wheel="onWheel"
  >
    <div class="mx-auto flex max-w-4xl flex-col gap-2">
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="text-muted">{{ formatUtcTime(new Date(viewStartMs).toISOString()) }}</span>
        <span class="font-medium">{{ formatUtcDateTime(currentTime) }}</span>
        <span class="text-muted">{{ formatUtcTime(new Date(viewEndMs).toISOString()) }}</span>
      </div>
      <USlider
        v-model="sliderMs"
        :min="viewStartMs"
        :max="viewEndMs"
        :step="1000"
      />
      <div class="flex items-center justify-center gap-2">
        <UFieldGroup size="sm">
          <UButton
            icon="i-lucide-zoom-out"
            color="neutral"
            variant="soft"
            aria-label="Zoom out"
            @click="emit('zoomOut')"
          />
          <UButton
            icon="i-lucide-zoom-in"
            color="neutral"
            variant="soft"
            aria-label="Zoom in"
            @click="emit('zoomIn')"
          />
          <UButton
            v-if="isZoomed"
            icon="i-lucide-maximize"
            color="neutral"
            variant="soft"
            aria-label="Reset zoom"
            @click="emit('resetZoom')"
          />
        </UFieldGroup>
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          color="primary"
          variant="soft"
          size="sm"
          @click="togglePlay"
        >
          {{ playing ? 'Pause' : 'Play' }}
        </UButton>
      </div>
      <p v-if="isZoomed" class="text-muted text-center text-xs">
        Scroll on the scrubber to zoom · Ctrl+scroll on the event list
      </p>
    </div>
  </div>
</template>
