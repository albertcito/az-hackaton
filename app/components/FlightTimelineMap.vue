<script setup lang="ts">
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { FlightWithSnapshot } from '~/types/flight'
import { isMapDarkAt } from '~/utils/mapDayNight'

const props = defineProps<{
  flights: FlightWithSnapshot[]
  airport: string
  currentTime: string
  selectedFlightId: string | null
}>()

const emit = defineEmits<{ select: [flightId: string] }>()

const container = ref<HTMLElement | null>(null)

const isDarkMap = computed(() => {
  if (!props.airport || !props.currentTime || !props.flights.length) return false
  for (const flight of props.flights) {
    if (flight.origin_airport_icao === props.airport) {
      return isMapDarkAt(props.currentTime, flight.lats[0], flight.lons[0])
    }
    if (flight.destination_airport_icao === props.airport) {
      const last = flight.lats.length - 1
      return isMapDarkAt(props.currentTime, flight.lats[last], flight.lons[last])
    }
  }
  return false
})

const { init, getViewer, setBaseImagery } = useCesiumViewer(container)
const { draw, clear, setSelected, updatePositions } = useFlightTimelineLayer(getViewer)

async function ensureViewer() {
  if (getViewer() || !container.value) return
  await init(isDarkMap.value)
  if (props.flights.length) {
    await draw(props.flights, props.airport)
    updatePositions(props.currentTime)
  }
}

watch(isDarkMap, async (isDark) => {
  if (!getViewer()) return
  await setBaseImagery(isDark)
})

watch(container, async () => {
  await ensureViewer()
  await setupClickHandler()
}, { flush: 'post' })

watch(
  () => [props.flights, props.airport] as const,
  async ([flights, airport]) => {
    await ensureViewer()
    if (!getViewer()) return
    if (flights.length) {
      await draw(flights, airport)
      updatePositions(props.currentTime)
      await setSelected(props.selectedFlightId)
    } else {
      await clear()
    }
  }
)

watch(
  () => props.selectedFlightId,
  (flightId) => {
    if (getViewer()) setSelected(flightId)
  }
)

watch(
  () => [props.flights, props.currentTime] as const,
  ([flights, time]) => {
    if (flights.length && time && getViewer()) updatePositions(time)
  }
)

let clickHandler: import('cesium').ScreenSpaceEventHandler | null = null

async function setupClickHandler() {
  const viewer = getViewer()
  if (!viewer || clickHandler) return

  const Cesium = await import('cesium')
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  clickHandler.setInputAction((click: { position: import('cesium').Cartesian2 }) => {
    const picked = getViewer()?.scene.pick(click.position)
    const entityId = picked?.id?.id as string | undefined
    if (!entityId?.startsWith('route-')) return
    emit('select', entityId.slice('route-'.length))
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

onUnmounted(() => {
  clickHandler?.destroy()
  clickHandler = null
})
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
