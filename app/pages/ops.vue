<script setup lang="ts">
import type { BandFilter } from '~/types/demand'

const store = useOpsStore()
const assistant = useAssistant()
const route = useRoute()

useHead({ title: 'Airspace Flow Console' })

function resetDemo() {
  store.resetView()
  assistant.resetServer()
}

onMounted(async () => {
  await store.loadDefault()
  // Optional deep-link to a specific bin / weather toggle (for demo links).
  const b = Number(route.query.bin)
  if (Number.isFinite(b) && store.nbins.value) {
    store.binIndex.value = Math.min(Math.max(0, Math.round(b)), store.nbins.value - 1)
  }
  if (route.query.wx === '1') store.showWeather.value = true
  if (route.query.scorecard === '1') showScorecard.value = true
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
const showScorecard = ref(false)
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

        <!-- live indicator -->
        <div
          v-if="store.mode.value === 'live'"
          class="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-200"
        >
          <span class="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
          <span class="font-data text-emerald-300/80">+{{ store.liveSummary.value?.total_delay_minutes ?? 0 }}m</span>
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

        <!-- reset demo -->
        <button
          v-if="store.mode.value === 'live' || store.selectedSector.value || store.binIndex.value !== store.peakStressBinIndex.value"
          type="button"
          class="transition-console flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-400/40 hover:text-zinc-100"
          title="Reset to baseline demo state"
          @click="resetDemo"
        >
          <UIcon name="i-lucide-rotate-ccw" class="size-4" />
        </button>

        <!-- scorecard -->
        <button
          type="button"
          class="transition-console flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-200"
          @click="showScorecard = true"
        >
          <UIcon name="i-lucide-layout-grid" class="size-4" />
          <span class="hidden lg:inline">Scorecard</span>
        </button>

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

    <!-- Assistant (bottom center, above timeline) -->
    <div
      class="absolute bottom-[12.75rem] left-1/2 z-20 w-[min(540px,calc(100vw-44rem))] -translate-x-1/2"
    >
      <AssistantPanel v-if="store.demand.value" class="max-h-[58vh]" />
    </div>

    <!-- Timeline + scrubber (bottom) -->
    <div class="absolute right-4 bottom-4 left-4 z-20 space-y-2">
      <StressTimeline v-if="store.demand.value" />
      <BinScrubber v-if="store.demand.value" />
    </div>

    <!-- Scorecard modal -->
    <ScorecardPanel v-if="showScorecard" @close="showScorecard = false" />
  </div>
</template>
