<script setup lang="ts">
const store = useOpsStore()

const svgRef = ref<SVGSVGElement | null>(null)
const H = 100

const n = computed(() => store.nbins.value)
const W = computed(() => Math.max(1, n.value - 1))

function pathFor(series: number[], close: boolean): string {
  if (series.length < 2) return ''
  const max = store.stressMax.value
  const pts = series.map((v, i) => `${i},${(H - (v / max) * H).toFixed(2)}`)
  const line = `M ${pts.join(' L ')}`
  return close ? `${line} L ${W.value},${H} L 0,${H} Z` : line
}

const activeArea = computed(() => pathFor(store.activeSeries.value, true))
const ghostLine = computed(() =>
  pathFor(store.mode.value === 'mitigated' ? store.baselineSeries.value : store.mitigatedSeries.value, false),
)

const currentX = computed(() => store.binIndex.value)
const peakX = computed(() => store.peakStressBinIndex.value)
const currentVal = computed(() => store.activeSeries.value[store.binIndex.value] ?? 0)

function binFromEvent(e: PointerEvent) {
  const svg = svgRef.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  store.binIndex.value = Math.round(frac * W.value)
}

const dragging = ref(false)
function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  binFromEvent(e)
}
function onMove(e: PointerEvent) {
  if (dragging.value) binFromEvent(e)
}
function onUp() {
  dragging.value = false
}
</script>

<template>
  <div class="glass-panel-strong px-4 pt-2.5 pb-3">
    <div class="mb-1.5 flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-300">
        <UIcon name="i-lucide-activity" class="size-4 text-cyan-300" />
        Network stress
        <span class="text-zinc-500">· total over-demand</span>
      </div>
      <div class="font-data text-xs" :class="store.mode.value === 'mitigated' ? 'text-green-300' : 'text-amber-300'">
        now {{ currentVal }} · peak {{ store.stressMax.value }}
      </div>
    </div>

    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      class="h-20 w-full cursor-pointer touch-none select-none"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointerleave="onUp"
    >
      <defs>
        <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
          <stop v-if="store.mode.value === 'mitigated'" offset="0%" stop-color="rgb(34,197,94)" stop-opacity="0.55" />
          <stop v-else offset="0%" stop-color="rgb(239,68,68)" stop-opacity="0.55" />
          <stop offset="100%" stop-color="rgb(34,211,238)" stop-opacity="0.04" />
        </linearGradient>
      </defs>

      <!-- baseline ghost (or mitigated ghost) -->
      <path :d="ghostLine" fill="none" stroke="rgba(148,163,184,0.45)" stroke-width="1"
        vector-effect="non-scaling-stroke" stroke-dasharray="3 3" />

      <!-- active series -->
      <path :d="activeArea" fill="url(#stressFill)" stroke="none" />
      <path :d="pathFor(store.activeSeries.value, false)" fill="none"
        :stroke="store.mode.value === 'mitigated' ? 'rgb(74,222,128)' : 'rgb(248,113,113)'"
        stroke-width="1.5" vector-effect="non-scaling-stroke" />

      <!-- peak marker -->
      <line :x1="peakX" :x2="peakX" y1="0" :y2="H" stroke="rgba(239,68,68,0.55)" stroke-width="1"
        vector-effect="non-scaling-stroke" stroke-dasharray="2 3" />

      <!-- current bin -->
      <line :x1="currentX" :x2="currentX" y1="0" :y2="H" stroke="rgb(34,211,238)" stroke-width="1.5"
        vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>
