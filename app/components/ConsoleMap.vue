<script setup lang="ts">
import 'cesium/Build/Cesium/Widgets/widgets.css'

const store = useOpsStore()
const container = ref<HTMLElement | null>(null)
const { init, getViewer } = useCesiumViewer(container)
const { build, recolor, isBuilt } = useSectorLayer(getViewer, (name) => {
  store.selectedSector.value = store.selectedSector.value === name ? null : name
})

function doRecolor() {
  recolor({
    sectorMap: store.sectorMap.value,
    binIndex: store.binIndex.value,
    mode: store.mode.value,
    band: store.band.value,
    selected: store.selectedSector.value,
  })
}

async function ensure() {
  if (getViewer() || !container.value) return
  await init(true) // dark console basemap
  if (store.sectorsGeo.value && !isBuilt()) {
    await build(store.sectorsGeo.value)
    doRecolor()
  }
}

watch(container, () => ensure(), { flush: 'post' })

watch(() => store.sectorsGeo.value, async (geo) => {
  if (geo && getViewer() && !isBuilt()) {
    await build(geo)
    doRecolor()
  }
})

watch(
  () => [
    store.binIndex.value,
    store.mode.value,
    store.band.value,
    store.selectedSector.value,
    store.demand.value,
  ] as const,
  () => doRecolor(),
)
</script>

<template>
  <div class="absolute inset-0">
    <ClientOnly>
      <div ref="container" class="h-full w-full" />
      <template #fallback>
        <div class="flex h-full w-full items-center justify-center bg-[#09090b]">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-cyan-400" />
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
