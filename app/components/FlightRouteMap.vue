<script setup lang="ts">
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { FlightWithSnapshot } from '~/types/flight'
import type { SectorTraffic } from '~/types/sector'

const props = defineProps<{
  flight: FlightWithSnapshot | null
  currentTime: string
  sectorTraffic?: SectorTraffic | null
  showSectorTraffic?: boolean
}>()

const emit = defineEmits<{ select: [flight: FlightWithSnapshot] }>()

const container = ref<HTMLElement | null>(null)
const ready = ref(false)
const isDarkMap = useMapTimeTheme(toRef(props, 'flight'), toRef(props, 'currentTime'))
const { init, getViewer, setBaseImagery } = useCesiumViewer(container)
const { draw, clear, updateAircraft } = useFlightRouteLayer(getViewer, (f) => emit('select', f))
const { render: renderSector, clear: clearSector } = useSectorTrafficLayer(getViewer)

async function syncSectorLayer() {
  if (!getViewer()) return
  if (props.showSectorTraffic && props.sectorTraffic) await renderSector(props.sectorTraffic)
  else clearSector()
}

async function ensureViewer() {
  if (getViewer() || !container.value) return
  await init(isDarkMap.value)
  ready.value = true
  if (props.flight) await draw(props.flight)
}

watch(isDarkMap, async (isDark) => {
  if (!getViewer()) return
  await setBaseImagery(isDark)
})

watch(container, () => ensureViewer(), { flush: 'post' })

watch(
  () => props.flight,
  async (flight) => {
    await ensureViewer()
    if (!getViewer()) return
    if (flight) await draw(flight)
    else await clear()
    // draw()/clear() wipe all entities — re-add the sector layer afterwards.
    await syncSectorLayer()
  }
)

watch(
  () => [props.flight, props.currentTime] as const,
  async ([flight, time]) => {
    if (flight && time && getViewer()) await updateAircraft(flight, time)
  }
)

watch(
  () => [props.sectorTraffic, props.showSectorTraffic] as const,
  () => syncSectorLayer()
)
</script>

<template>
  <div class="absolute inset-0">
    <ClientOnly>
      <div ref="container" class="h-full w-full" />
      <template #fallback>
        <div class="bg-muted flex h-full w-full items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.cesium-viewer),
:deep(.cesium-viewer-cesiumWidgetContainer),
:deep(.cesium-widget),
:deep(.cesium-widget canvas) {
  width: 100%;
  height: 100%;
}

:deep(.cesium-viewer-bottom) {
  display: none;
}
</style>
