<script setup lang="ts">
import type { BandFilter } from '~/types/demand'

const store = useOpsStore()
const route = useRoute()

onMounted(async () => {
  await store.loadDefault()
  // Optional deep-link to a specific bin / weather toggle (for demo links).
  const b = Number(route.query.bin)
  if (Number.isFinite(b) && store.nbins.value) {
    store.binIndex.value = Math.min(Math.max(0, Math.round(b)), store.nbins.value - 1)
  }
  if (route.query.wx === '1') store.showWeather.value = true
})

const bands: { label: string, value: BandFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Low', value: 'LOW' },
]

const stressNow = computed(() =>
  store.demand.value?.stress.find(s => s.bin_index === store.binIndex.value) ?? null,
)
const overCount = computed(() => store.hotspots.value.length)
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100">
    <ConsoleMap />

    <!-- Header -->
    <header class="panel-rise glass-panel absolute top-4 right-4 left-4 z-20 flex items-center justify-between gap-4 px-4 py-3">
      <div class="flex items-center gap-3">
        <div class="flex size-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <UIcon name="i-lucide-radar" class="size-5" />
        </div>
        <div>
          <h1 class="text-sm leading-tight font-semibold tracking-wide text-zinc-100">
            Airspace Flow Console
          </h1>
          <p class="font-data text-xs text-zinc-400">
            {{ store.askedAt.value ? new Date(store.askedAt.value).toISOString().replace('.000Z', 'Z') : 'loading…' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- live stress readout -->
        <div class="mr-1 hidden items-center gap-3 md:flex">
          <div class="text-right">
            <div class="font-data text-lg leading-none font-semibold" :class="overCount > 0 ? 'text-red-400' : 'text-green-400'">
              {{ overCount }}
            </div>
            <div class="text-[10px] tracking-wide text-zinc-500 uppercase">over-demand</div>
          </div>
          <div class="text-right">
            <div class="font-data text-lg leading-none font-semibold text-zinc-200">
              {{ stressNow?.total_flights ?? '—' }}
            </div>
            <div class="text-[10px] tracking-wide text-zinc-500 uppercase">airborne</div>
          </div>
        </div>

        <!-- weather toggle -->
        <button
          type="button"
          class="transition-console flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
          :class="store.showWeather.value
            ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
            : 'border-[var(--glass-border)] text-zinc-400 hover:text-zinc-200'"
          @click="store.showWeather.value = !store.showWeather.value"
        >
          <UIcon name="i-lucide-cloud-lightning" class="size-4" />
          <span class="hidden sm:inline">Weather</span>
        </button>

        <!-- band filter -->
        <div class="flex rounded-lg border border-[var(--glass-border)] p-0.5">
          <button
            v-for="b in bands"
            :key="b.value"
            type="button"
            class="transition-console cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium"
            :class="store.band.value === b.value ? 'bg-cyan-500/20 text-cyan-200' : 'text-zinc-400 hover:text-zinc-200'"
            @click="store.band.value = b.value"
          >
            {{ b.label }}
          </button>
        </div>

        <UColorModeButton class="opacity-0 pointer-events-none w-0" />
      </div>
    </header>

    <!-- Resolution (right) -->
    <div class="absolute top-[5.25rem] right-4 z-20 flex w-[330px] flex-col" style="bottom: 12.5rem">
      <ResolvePanel v-if="store.demand.value" />
    </div>

    <!-- error toast -->
    <div v-if="store.error.value" class="glass-panel-strong absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-5 py-4 text-sm text-red-300">
      <UIcon name="i-lucide-triangle-alert" class="mr-2 inline size-4" />
      {{ store.error.value }}
    </div>

    <!-- Hotspots (left) -->
    <div class="absolute top-[5.25rem] left-4 z-20 flex w-[340px] flex-col" style="bottom: 12.5rem">
      <HotspotPanel v-if="store.demand.value" />
    </div>

    <!-- Timeline + scrubber (bottom) -->
    <div class="absolute right-4 bottom-4 left-4 z-20 space-y-2">
      <StressTimeline v-if="store.demand.value" />
      <BinScrubber v-if="store.demand.value" />
    </div>
  </div>
</template>
