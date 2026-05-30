<script setup lang="ts">
import { formatUtcDateTime, formatUtcTime } from '~/utils/formatFlight'

const props = defineProps<{
  startIso: string
  endIso: string
}>()

const currentTime = defineModel<string>('currentTime', { required: true })

const startMs = computed(() => new Date(props.startIso).getTime())
const endMs = computed(() => new Date(props.endIso).getTime())
const sliderMs = ref(0)

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

const startIsoRef = computed(() => props.startIso)
const endIsoRef = computed(() => props.endIso)
const { playing, play, pause } = useFlightAnimation(startIsoRef, endIsoRef, currentTime)

watch(
  () => [props.startIso, props.endIso] as const,
  () => syncSliderFromCurrentTime(),
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
</script>

<template>
  <div class="border-default bg-default/95 absolute right-0 bottom-0 left-0 z-10 border-t p-3 backdrop-blur">
    <div class="mx-auto flex max-w-4xl flex-col gap-2">
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="text-muted">{{ formatUtcTime(startIso) }}</span>
        <span class="font-medium">{{ formatUtcDateTime(currentTime) }}</span>
        <span class="text-muted">{{ formatUtcTime(endIso) }}</span>
      </div>
      <USlider
        v-model="sliderMs"
        :min="startMs"
        :max="endMs"
        :step="1000"
      />
      <div class="flex justify-center">
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          color="primary"
          variant="soft"
          size="sm"
          @click="togglePlay"
        >
          {{ playing ? 'Pause' : 'Play day' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
