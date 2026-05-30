<script setup lang="ts">
import type { Alert } from '~/types/alert'

const store = useOpsStore()
const assistant = useAssistant()

const KIND_ICON: Record<string, string> = {
  turbulence: 'i-lucide-wind',
  convection: 'i-lucide-cloud-lightning',
  closure: 'i-lucide-ban',
  overdemand: 'i-lucide-triangle-alert',
}
const SEV_BAR: Record<string, string> = {
  high: 'bg-red-500',
  med: 'bg-amber-500',
  low: 'bg-zinc-500',
}
const SEV_TEXT: Record<string, string> = {
  high: 'text-red-300',
  med: 'text-amber-300',
  low: 'text-zinc-400',
}

function regionLabel(a: Alert): string {
  const r = a.region
  if (r.kind === 'sector') return r.ref ?? 'sector'
  if (r.kind === 'circle') return `${Math.round(r.radius_nm ?? 0)} nm area`
  return 'area'
}

// Countdown is relative to the scrubber "now" (static snapshot) — advances as you scrub/play.
function mins(eta: string): number {
  const now = store.currentBinIso.value ? new Date(store.currentBinIso.value).getTime() : Date.now()
  return Math.round((new Date(eta).getTime() - now) / 60000)
}

function advise(a: Alert) {
  assistant.send(`Draft a controller advisory for the flights in alert ${a.id} entering ${regionLabel(a)}.`)
}
function reroute(a: Alert) {
  if (a.region.kind === 'sector') assistant.send(`Reroute the flights around ${a.region.ref} and clear alert ${a.id}.`)
  else assistant.send(`Suggest how to handle the flights in alert ${a.id}.`)
}
</script>

<template>
  <div class="glass-panel panel-rise flex max-h-full flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-bell-ring" class="size-4 text-amber-300" />
        <h2 class="text-sm font-semibold text-zinc-100">Alerts</h2>
        <span v-if="store.activeAlerts.value.length" class="font-data rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">
          {{ store.activeAlerts.value.length }}
        </span>
      </div>
      <span class="font-data text-xs text-zinc-500">{{ store.formatBin(store.currentBinIso.value) }}</span>
    </div>

    <div class="scroll-thin min-h-0 flex-1 overflow-y-auto">
    <div v-if="!store.activeAlerts.value.length" class="px-4 py-8 text-center text-sm text-zinc-500">
      <UIcon name="i-lucide-bell-off" class="mx-auto mb-2 size-6 text-zinc-600" />
      No active alerts. Raise a hazard or scrub into convective weather.
    </div>

    <div
      v-for="a in store.activeAlerts.value"
      :key="a.id"
      class="relative cursor-pointer border-b border-[var(--glass-border)] px-4 py-3 transition-console hover:bg-white/[0.03]"
      @click="store.focusAlert(a)"
    >
      <span class="absolute top-0 left-0 h-full w-1" :class="SEV_BAR[a.severity]" />

      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon :name="KIND_ICON[a.kind] ?? 'i-lucide-alert-circle'" class="size-4" :class="SEV_TEXT[a.severity]" />
          <span class="font-data text-sm font-semibold text-zinc-100">{{ regionLabel(a) }}</span>
          <span class="text-[10px] uppercase tracking-wide" :class="SEV_TEXT[a.severity]">{{ a.kind }}</span>
        </div>
        <span v-if="a.status === 'ack'" class="rounded bg-zinc-500/20 px-1.5 py-0.5 text-[10px] text-zinc-300">ack</span>
      </div>

      <p class="mb-2 text-xs text-zinc-400">{{ a.message }}</p>

      <!-- affected flights with countdown -->
      <div class="space-y-0.5">
        <button
          v-for="f in a.affected.slice(0, 6)"
          :key="f.fid"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-console hover:bg-white/5"
          :class="store.selectedFlightId.value === f.fid ? 'bg-cyan-500/15' : ''"
          @click.stop="store.selectedFlightId.value = store.selectedFlightId.value === f.fid ? null : f.fid"
        >
          <span class="font-data truncate text-xs text-zinc-200">{{ f.fid.split('|')[0] }}
            <span class="text-zinc-500">{{ f.origin }}→{{ f.dest }}</span>
          </span>
          <span class="font-data shrink-0 text-[11px] font-semibold"
            :class="mins(f.eta) <= 5 ? 'text-red-300' : mins(f.eta) <= 12 ? 'text-amber-300' : 'text-cyan-300'">
            {{ mins(f.eta) <= 0 ? 'now' : `+${mins(f.eta)}m` }}
          </span>
        </button>
        <div v-if="a.affected.length > 6" class="px-1.5 text-[11px] text-zinc-500">+{{ a.affected.length - 6 }} more</div>
      </div>

      <!-- actions -->
      <div class="mt-2 flex gap-1.5">
        <button type="button" class="flex-1 cursor-pointer rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-200 transition-console hover:bg-cyan-500/20" @click.stop="advise(a)">
          Advise
        </button>
        <button v-if="a.region.kind === 'sector'" type="button" class="flex-1 cursor-pointer rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-200 transition-console hover:bg-violet-500/20" @click.stop="reroute(a)">
          Reroute
        </button>
        <button type="button" class="cursor-pointer rounded-md border border-[var(--glass-border)] px-2 py-1 text-[11px] font-medium text-zinc-400 transition-console hover:text-zinc-100" @click.stop="store.resolveAlert(a.id)">
          Dismiss
        </button>
      </div>
    </div>
    </div>
  </div>
</template>
