import type { Ref } from 'vue'

async function createImageryProvider(
  Cesium: typeof import('cesium'),
  hasToken: boolean,
  isDark: boolean
) {
  if (isDark) {
    return new Cesium.UrlTemplateImageryProvider({
      url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors © CARTO'
    })
  }

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

function applySceneTheme(viewer: import('cesium').Viewer, Cesium: typeof import('cesium'), isDark: boolean) {
  const { scene } = viewer

  if (isDark) {
    scene.backgroundColor = Cesium.Color.fromCssColorString('#09090b')
    // Deep slate base so the globe + sectors stay visible even if external
    // dark basemap tiles are slow to load.
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1220')
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false
    if (scene.skyBox) scene.skyBox.show = false
    if (scene.sun) scene.sun.show = false
    if (scene.moon) scene.moon.show = false
    scene.globe.showGroundAtmosphere = false
    scene.fog.enabled = false
    return
  }

  scene.backgroundColor = Cesium.Color.BLACK
  if (scene.skyAtmosphere) scene.skyAtmosphere.show = true
  if (scene.skyBox) scene.skyBox.show = true
  if (scene.sun) scene.sun.show = true
  if (scene.moon) scene.moon.show = true
  scene.globe.showGroundAtmosphere = true
  scene.fog.enabled = true
}

export function useCesiumViewer(container: Ref<HTMLElement | null>) {
  let viewer: import('cesium').Viewer | null = null
  let hasToken = false

  async function setBaseImagery(isDark: boolean) {
    if (!viewer) return

    const Cesium = await import('cesium')
    const provider = await createImageryProvider(Cesium, hasToken, isDark)

    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(provider)
    applySceneTheme(viewer, Cesium, isDark)
  }

  async function init(isDark = false) {
    if (!container.value || viewer) return viewer

    const Cesium = await import('cesium')
    const config = useRuntimeConfig()
    hasToken = Boolean(config.public.cesiumIonToken)

    if (hasToken) {
      Cesium.Ion.defaultAccessToken = config.public.cesiumIonToken
    }

    const imageryProvider = await createImageryProvider(Cesium, hasToken, isDark)

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
    applySceneTheme(viewer, Cesium, isDark)
    viewer.resize()
    return viewer
  }

  function destroy() {
    viewer?.destroy()
    viewer = null
  }

  onUnmounted(destroy)

  return { init, destroy, getViewer: () => viewer, setBaseImagery }
}
