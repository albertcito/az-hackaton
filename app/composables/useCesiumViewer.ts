import type { Ref } from 'vue'

async function createImageryProvider(Cesium: typeof import('cesium'), hasToken: boolean) {
  if (hasToken) {
    try {
      return await Cesium.createWorldImageryAsync()
    } catch {
      // fall through to OSM
    }
  }

  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maximumLevel: 19,
    credit: '© OpenStreetMap contributors'
  })
}

export function useCesiumViewer(container: Ref<HTMLElement | null>) {
  let viewer: import('cesium').Viewer | null = null

  async function init() {
    if (!container.value || viewer) return viewer

    const Cesium = await import('cesium')
    const config = useRuntimeConfig()
    const hasToken = Boolean(config.public.cesiumIonToken)

    if (hasToken) {
      Cesium.Ion.defaultAccessToken = config.public.cesiumIonToken
    }

    const imageryProvider = await createImageryProvider(Cesium, hasToken)

    viewer = new Cesium.Viewer(container.value, {
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: new Cesium.ImageryLayer(imageryProvider)
    })

    if (hasToken) {
      try {
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync()
      } catch {
        // ellipsoid terrain is fine
      }
    }

    viewer.scene.globe.enableLighting = false
    viewer.resize()
    return viewer
  }

  function destroy() {
    viewer?.destroy()
    viewer = null
  }

  onUnmounted(destroy)

  return { init, destroy, getViewer: () => viewer }
}
