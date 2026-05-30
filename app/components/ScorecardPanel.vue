<script setup lang="ts">
interface Row {
  snapshot: string
  asked_at: string
  flights: number
  n_over_sectors: number
  mitigated_over_sectors: number
  peak_stress: number
  total_over_area: number
  total_delay_minutes: number
}

const emit = defineEmits<{ close: [] }>()
const store = useOpsStore()

const rows = ref<Row[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await $fetch<{ rows: Row[] }>('/api/scorecard')
    rows.value = res.rows
  } catch (e: any) {
    error.value = e?.message ?? 'scorecard unavailable'
  } finally {
    loading.value = false
  }
})

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  const p = (n: number) => String(n).padStart(2, '0')
  return `${mon} ${p(d.getUTCDate())} '${String(d.getUTCFullYear()).slice(2)} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`
}

const totals = computed(() => {
  const t = { flights: 0, over: 0, mit: 0, delay: 0 }
  for (const r of rows.value) {
    t.flights += r.flights; t.over += r.n_over_sectors; t.mit += r.mitigated_over_sectors; t.delay += r.total_delay_minutes
  }
  return t
})
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center p-6">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

    <div class="glass-panel-strong panel-rise relative flex max-h-[86vh] w-[min(900px,92vw)] flex-col overflow-hidden">
      <div class="flex items-center justify-between border-b border-[var(--glass-border)] px-5 py-3.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-layout-grid" class="size-4 text-cyan-300" />
          <h2 class="text-sm font-semibold text-zinc-100">Self-eval scorecard</h2>
          <span class="text-xs text-zinc-500">· detect → resolve, across every scenario</span>
        </div>
        <button type="button" class="cursor-pointer text-zinc-400 hover:text-zinc-100" @click="emit('close')">
          <UIcon name="i-lucide-x" class="size-5" />
        </button>
      </div>

      <div v-if="loading" class="p-10 text-center text-zinc-500">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
      </div>
      <div v-else-if="error" class="p-8 text-center text-sm text-red-300">{{ error }}</div>

      <div v-else class="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-[var(--glass-bg-strong)] text-[11px] tracking-wide text-zinc-500 uppercase backdrop-blur">
            <tr>
              <th class="px-5 py-2.5 text-left font-medium">Scenario</th>
              <th class="px-3 py-2.5 text-right font-medium">Flights</th>
              <th class="px-3 py-2.5 text-right font-medium">Peak stress</th>
              <th class="px-3 py-2.5 text-center font-medium">Over-demand → mitigated</th>
              <th class="px-5 py-2.5 text-right font-medium">Delay min</th>
            </tr>
          </thead>
          <tbody class="glass-divide">
            <tr
              v-for="r in rows"
              :key="r.snapshot"
              class="transition-console hover:bg-white/[0.03]"
              :class="r.snapshot === store.snapshotId.value ? 'bg-cyan-500/10' : ''"
            >
              <td class="px-5 py-2.5">
                <span class="font-data text-zinc-200">{{ fmtDate(r.asked_at) }}</span>
                <span v-if="r.snapshot === store.snapshotId.value" class="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">demo</span>
              </td>
              <td class="font-data px-3 py-2.5 text-right text-zinc-300">{{ r.flights.toLocaleString() }}</td>
              <td class="font-data px-3 py-2.5 text-right text-amber-300">{{ r.peak_stress }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center justify-center gap-2">
                  <span class="font-data w-6 text-right font-semibold text-red-400">{{ r.n_over_sectors }}</span>
                  <div class="h-1.5 w-24 overflow-hidden rounded-full bg-red-500/20">
                    <div class="h-full rounded-full bg-green-500" :style="{ width: `${r.n_over_sectors ? (1 - r.mitigated_over_sectors / r.n_over_sectors) * 100 : 0}%` }" />
                  </div>
                  <span class="font-data w-6 font-semibold text-green-400">{{ r.mitigated_over_sectors }}</span>
                </div>
              </td>
              <td class="font-data px-5 py-2.5 text-right text-cyan-300">{{ r.total_delay_minutes.toLocaleString() }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-[var(--glass-border-strong)] text-zinc-300">
              <td class="px-5 py-2.5 text-xs tracking-wide text-zinc-500 uppercase">{{ rows.length }} scenarios</td>
              <td class="font-data px-3 py-2.5 text-right">{{ totals.flights.toLocaleString() }}</td>
              <td />
              <td class="px-3 py-2.5 text-center">
                <span class="font-data font-semibold text-red-400">{{ totals.over }}</span>
                <UIcon name="i-lucide-arrow-right" class="mx-1 inline size-3 text-zinc-500" />
                <span class="font-data font-semibold text-green-400">{{ totals.mit }}</span>
              </td>
              <td class="font-data px-5 py-2.5 text-right text-cyan-300">{{ totals.delay.toLocaleString() }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
