<script setup lang="ts">
import type { FlightBasics } from '~/server/utils/routesCache'
import { heatCss } from '~/utils/heat'

const store = useOpsStore()

const memberFlights = ref<FlightBasics[]>([])
const loadingMembers = ref(false)

async function loadMembersFor(sector: string | null, bin: number) {
  memberFlights.value = []
  if (!sector || !store.snapshotId.value) return
  const fids = store.memberFids(sector, bin)
  if (!fids.length) return
  loadingMembers.value = true
  try {
    const res = await $fetch<{ flights: FlightBasics[] }>('/api/flights/batch', {
      method: 'POST',
      body: { fids },
    })
    memberFlights.value = res.flights
  } catch {
    memberFlights.value = []
  } finally {
    loadingMembers.value = false
  }
}

watch(
  () => [store.selectedSector.value, store.binIndex.value] as const,
  ([sector, bin]) => loadMembersFor(sector, bin),
)

function onSectorClick(name: string) {
  store.selectSector(store.selectedSector.value === name ? null : name)
}

function pad(n: number) {
  return Math.round(n).toLocaleString()
}

function wx(sector: string): number {
  return store.weatherDisplaced(sector, store.binIndex.value) ?? 0
}
</script>

<template>
  <div class="glass-panel panel-rise flex max-h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-triangle-alert" class="size-4 text-red-400" />
        <h2 class="text-sm font-semibold text-zinc-100">Hotspots</h2>
        <span class="font-data rounded-full bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300">
          {{ store.hotspots.value.length }}
        </span>
      </div>
      <span class="font-data text-xs text-zinc-500">{{ store.formatBin(store.currentBinIso.value) }}</span>
    </div>

    <div class="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div v-if="!store.hotspots.value.length" class="px-4 py-8 text-center text-sm text-zinc-500">
        <UIcon name="i-lucide-check-circle" class="mx-auto mb-2 size-6 text-green-500/70" />
        No over-demand sectors at this moment.
      </div>

      <div v-for="h in store.hotspots.value" :key="h.sector.name">
        <button
          type="button"
          class="transition-console w-full cursor-pointer px-4 py-2.5 text-left hover:bg-white/[0.03]"
          :class="store.selectedSector.value === h.sector.name ? 'bg-cyan-500/10' : ''"
          @click="onSectorClick(h.sector.name)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-data text-sm font-semibold text-zinc-100">{{ h.sector.name }}</span>
              <span
                class="rounded px-1 py-0.5 text-[10px] font-medium"
                :class="h.sector.band === 'HIGH' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-sky-500/15 text-sky-300'"
              >{{ h.sector.band }}</span>
              <span
                v-if="wx(h.sector.name) > 0"
                class="flex items-center gap-0.5 rounded bg-violet-500/15 px-1 py-0.5 text-[10px] font-medium text-violet-300"
                :title="`${Math.round(wx(h.sector.name) * 100)}% weather-displaced (heuristic)`"
              >
                <UIcon name="i-lucide-cloud-lightning" class="size-3" />{{ Math.round(wx(h.sector.name) * 100) }}%
              </span>
            </div>
            <span class="font-data text-sm font-semibold" :style="{ color: heatCss(h.count / h.sector.capacity) }">
              {{ h.count }}<span class="text-zinc-500">/{{ h.sector.capacity }}</span>
            </span>
          </div>
          <div class="mt-1.5 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                class="h-full rounded-full transition-console"
                :style="{ width: `${Math.min(100, (h.count / h.sector.capacity) * 100)}%`, background: heatCss(h.count / h.sector.capacity, 0.9) }"
              />
            </div>
            <span class="font-data text-[11px] font-semibold text-red-300">+{{ h.over }}</span>
          </div>
        </button>

        <!-- member flights -->
        <div v-if="store.selectedSector.value === h.sector.name" class="bg-black/20 px-2 pb-2">
          <div v-if="loadingMembers" class="px-2 py-3 text-xs text-zinc-500">
            <UIcon name="i-lucide-loader-circle" class="mr-1 inline size-3 animate-spin" /> loading flights…
          </div>
          <div v-else-if="!memberFlights.length" class="px-2 py-3 text-xs text-zinc-500">
            Membership not precomputed for this bin.
          </div>
          <button
            v-for="f in memberFlights"
            :key="f.id"
            type="button"
            class="transition-console flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
            :class="store.selectedFlightId.value === f.id ? 'bg-cyan-500/15 ring-1 ring-cyan-400/40' : ''"
            @click="store.selectedFlightId.value = store.selectedFlightId.value === f.id ? null : f.id"
          >
            <div class="min-w-0">
              <div class="font-data truncate text-xs font-semibold text-zinc-100">{{ f.flight_number }}</div>
              <div class="font-data truncate text-[11px] text-zinc-500">
                {{ f.origin_airport_icao }} → {{ f.destination_airport_icao }}
              </div>
            </div>
            <div class="font-data shrink-0 text-right text-[11px] text-zinc-400">
              {{ pad(f.cruise_altitude_ft) }} ft
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
