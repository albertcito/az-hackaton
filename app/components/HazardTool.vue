<script setup lang="ts">
const store = useOpsStore()
const open = ref(false)

const kinds = [
  { v: 'turbulence', label: 'Turbulence', icon: 'i-lucide-wind' },
  { v: 'convection', label: 'Convection', icon: 'i-lucide-cloud-lightning' },
  { v: 'closure', label: 'Closure', icon: 'i-lucide-ban' },
]
const horizons = [15, 25, 40]

function raiseSector() {
  if (!store.selectedSector.value) return
  store.raiseHazard({ kind: 'sector', ref: store.selectedSector.value }, store.hazardKind.value, store.hazardHorizon.value)
  open.value = false
}
function placeCircle() {
  store.placingCircle.value = true
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      v-if="store.placingCircle.value"
      type="button"
      class="transition-console flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-red-200"
      @click="store.placingCircle.value = false"
    >
      <UIcon name="i-lucide-crosshair" class="size-4 animate-pulse" />
      Click the map… <span class="opacity-70">(cancel)</span>
    </button>
    <button
      v-else
      type="button"
      class="transition-console flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-400/30 px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:border-amber-400/50 hover:bg-amber-500/10"
      @click="open = !open"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-4" />
      <span class="hidden sm:inline">Hazard</span>
    </button>

    <div v-if="open" class="glass-panel-strong absolute top-full right-0 z-30 mt-2 w-64 p-3">
      <div class="mb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Hazard kind</div>
      <div class="mb-3 flex gap-1">
        <button
          v-for="k in kinds"
          :key="k.v"
          type="button"
          class="transition-console flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] font-medium"
          :class="store.hazardKind.value === k.v ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-[var(--glass-border)] text-zinc-400 hover:text-zinc-200'"
          @click="store.hazardKind.value = k.v"
        >
          <UIcon :name="k.icon" class="size-4" />{{ k.label }}
        </button>
      </div>

      <div class="mb-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Lookahead</div>
      <div class="mb-3 flex gap-1">
        <button
          v-for="h in horizons"
          :key="h"
          type="button"
          class="transition-console flex-1 cursor-pointer rounded-md border px-2 py-1 text-xs font-medium"
          :class="store.hazardHorizon.value === h ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-[var(--glass-border)] text-zinc-400 hover:text-zinc-200'"
          @click="store.hazardHorizon.value = h"
        >
          {{ h }}m
        </button>
      </div>

      <button
        type="button"
        class="transition-console mb-1.5 w-full cursor-pointer rounded-md bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40"
        :disabled="!store.selectedSector.value"
        @click="raiseSector"
      >
        {{ store.selectedSector.value ? `Raise on ${store.selectedSector.value}` : 'Select a sector first' }}
      </button>
      <button
        type="button"
        class="transition-console flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--glass-border)] px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100"
        @click="placeCircle"
      >
        <UIcon name="i-lucide-crosshair" class="size-3.5" />
        Place circle on map
      </button>
    </div>
  </div>
</template>
