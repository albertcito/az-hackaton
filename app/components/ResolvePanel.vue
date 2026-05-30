<script setup lang="ts">
const store = useOpsStore()

const mit = computed(() => store.mitigation.value)
const nFlights = computed(() => mit.value?.actions.length ?? 0)

function flightNumber(fid: string): string {
  return fid.split('|')[0] ?? fid
}

// Top actions by delay, for the list (full set can be hundreds).
const topActions = computed(() =>
  [...(mit.value?.actions ?? [])].sort((a, b) => b.minutes - a.minutes).slice(0, 40),
)

const legend = [
  { label: '0', cls: 'bg-green-500' },
  { cls: 'bg-lime-500' },
  { cls: 'bg-yellow-500' },
  { cls: 'bg-amber-500' },
  { label: 'over', cls: 'bg-red-500' },
]
</script>

<template>
  <div class="glass-panel panel-rise flex max-h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-wand-sparkles" class="size-4 text-cyan-300" />
        <h2 class="text-sm font-semibold text-zinc-100">Resolution</h2>
      </div>
      <span class="font-data text-[11px] text-zinc-500">ground-delay</span>
    </div>

    <!-- Baseline / Mitigated toggle -->
    <div class="px-4 pt-3">
      <div class="flex rounded-lg border border-[var(--glass-border)] p-0.5">
        <button
          type="button"
          class="transition-console flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold"
          :class="store.mode.value === 'baseline' ? 'bg-red-500/20 text-red-200' : 'text-zinc-400 hover:text-zinc-200'"
          @click="store.mode.value = 'baseline'"
        >
          Baseline
        </button>
        <button
          type="button"
          class="transition-console flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold"
          :class="store.mode.value === 'mitigated' ? 'bg-green-500/20 text-green-200' : 'text-zinc-400 hover:text-zinc-200'"
          @click="store.mode.value = 'mitigated'"
        >
          Mitigated
        </button>
      </div>
    </div>

    <!-- Before/after headline -->
    <div v-if="mit" class="grid grid-cols-3 gap-2 px-4 py-3">
      <div class="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
        <div class="font-data flex items-center justify-center gap-1 text-lg font-bold leading-none">
          <span class="text-red-400">{{ mit.baseline.n_over_sectors }}</span>
          <UIcon name="i-lucide-arrow-right" class="size-3 text-zinc-500" />
          <span class="text-green-400">{{ mit.mitigated.n_over_sectors }}</span>
        </div>
        <div class="mt-1 text-[10px] tracking-wide text-zinc-500 uppercase">over sectors</div>
      </div>
      <div class="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
        <div class="font-data text-lg font-bold leading-none text-cyan-300">{{ mit.total_delay_minutes }}</div>
        <div class="mt-1 text-[10px] tracking-wide text-zinc-500 uppercase">delay min</div>
      </div>
      <div class="rounded-lg bg-white/[0.03] px-2 py-2 text-center">
        <div class="font-data text-lg font-bold leading-none text-zinc-200">{{ nFlights }}</div>
        <div class="mt-1 text-[10px] tracking-wide text-zinc-500 uppercase">flights</div>
      </div>
    </div>

    <div class="px-4 pb-1 text-[11px] text-zinc-500">
      Over-demand area
      <span class="font-data text-red-300">{{ mit?.baseline.total_over_area ?? '—' }}</span>
      <UIcon name="i-lucide-arrow-right" class="mx-0.5 inline size-3" />
      <span class="font-data text-green-300">{{ mit?.mitigated.total_over_area ?? '—' }}</span>
    </div>

    <!-- Action list -->
    <div class="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <div class="px-2 pb-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        Top ground delays
      </div>
      <button
        v-for="a in topActions"
        :key="a.fid"
        type="button"
        class="transition-console flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
        :class="store.selectedFlightId.value === a.fid ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40' : ''"
        @click="store.selectedFlightId.value = store.selectedFlightId.value === a.fid ? null : a.fid"
      >
        <span class="font-data truncate text-xs font-semibold text-zinc-100">{{ flightNumber(a.fid) }}</span>
        <div class="flex shrink-0 items-center gap-2">
          <span class="font-data text-[11px] text-zinc-500">{{ a.relieves.length }} sct</span>
          <span class="font-data rounded bg-cyan-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-300">
            +{{ a.minutes }}m
          </span>
        </div>
      </button>
    </div>

    <!-- Heat legend -->
    <div class="flex items-center justify-between border-t border-[var(--glass-border)] px-4 py-2">
      <span class="text-[10px] tracking-wide text-zinc-500 uppercase">load / capacity</span>
      <div class="flex items-center gap-1">
        <span v-for="(l, i) in legend" :key="i" class="size-2.5 rounded-sm" :class="l.cls" />
      </div>
    </div>
  </div>
</template>
