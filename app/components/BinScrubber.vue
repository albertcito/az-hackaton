<script setup lang="ts">
const store = useOpsStore()

const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  playing.value = false
}

function togglePlay() {
  if (playing.value) return stop()
  playing.value = true
  timer = setInterval(() => {
    if (store.binIndex.value >= store.nbins.value - 1) store.binIndex.value = 0
    else store.binIndex.value = store.binIndex.value + 1
  }, 550)
}

onUnmounted(stop)

const peakPct = computed(() =>
  store.nbins.value > 1 ? (store.peakStressBinIndex.value / (store.nbins.value - 1)) * 100 : 0,
)
const askedPct = computed(() => {
  // asked_at sits at the bin matching the snapshot timestamp; find nearest bin.
  const asked = store.askedAt.value ? new Date(store.askedAt.value).getTime() : null
  if (asked == null || store.bins.value.length < 2) return null
  let bi = 0
  let best = Infinity
  store.bins.value.forEach((iso, i) => {
    const d = Math.abs(new Date(iso).getTime() - asked)
    if (d < best) { best = d; bi = i }
  })
  return (bi / (store.nbins.value - 1)) * 100
})

const onScrub = (e: Event) => {
  store.binIndex.value = Number((e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="glass-panel-strong px-4 py-3">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="transition-console flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border-strong)] bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <UIcon :name="playing ? 'i-lucide-pause' : 'i-lucide-play'" class="size-5" />
      </button>

      <div class="min-w-0 flex-1">
        <div class="mb-1 flex items-center justify-between text-xs text-zinc-400">
          <span class="font-data text-sm font-semibold text-zinc-100">
            {{ store.formatBin(store.currentBinIso.value) }}
          </span>
          <span class="font-data">bin {{ store.binIndex.value }} / {{ store.nbins.value - 1 }}</span>
        </div>

        <div class="relative">
          <!-- peak + asked_at ticks -->
          <div
            v-if="askedPct !== null"
            class="pointer-events-none absolute top-1/2 z-10 h-4 w-px -translate-y-1/2 bg-cyan-400/60"
            :style="{ left: `${askedPct}%` }"
            title="asked_at"
          />
          <div
            class="pointer-events-none absolute top-1/2 z-10 h-4 w-px -translate-y-1/2 bg-red-400/80"
            :style="{ left: `${peakPct}%` }"
            title="peak stress"
          />
          <input
            type="range"
            class="scrub w-full cursor-pointer"
            :min="0"
            :max="Math.max(0, store.nbins.value - 1)"
            :value="store.binIndex.value"
            @input="onScrub"
          >
        </div>
      </div>

      <button
        type="button"
        class="transition-console hidden shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 sm:flex"
        @click="store.binIndex.value = store.peakStressBinIndex.value"
      >
        <UIcon name="i-lucide-flame" class="size-4" />
        Jump to peak
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrub {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.35), rgba(148, 163, 184, 0.18));
  outline: none;
}
.scrub::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #22d3ee;
  border: 2px solid #0b1220;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
  cursor: pointer;
}
.scrub::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #22d3ee;
  border: 2px solid #0b1220;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
  cursor: pointer;
}
</style>
