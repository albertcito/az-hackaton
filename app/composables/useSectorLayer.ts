import type { BandFilter, ConsoleMode, DemandSector } from '~/types/demand'
import { feetToMeters } from '~/utils/interpolatePosition'
import { heatRgb } from '~/utils/heat'

interface RecolorState {
  sectorMap: Map<string, DemandSector>
  binIndex: number
  mode: ConsoleMode
  band: BandFilter
  selected: string | null
}

// 3D airspace sectors as extruded translucent boxes, colored by occupancy /
// capacity at the current bin. Only occupied sectors render (declutter); over
// capacity glows red. Built once; recolored imperatively on state change.
export function useSectorLayer(
  getViewer: () => import('cesium').Viewer | null,
  onSelect: (name: string) => void,
) {
  let Cesium: typeof import('cesium') | null = null
  const entities = new Map<string, import('cesium').Entity>()
  let handler: import('cesium').ScreenSpaceEventHandler | null = null
  let built = false

  async function build(geo: any) {
    const viewer = getViewer()
    if (!viewer || built || !geo) return
    Cesium = await import('cesium')

    for (const f of geo.features) {
      const name: string = f.properties.name
      const altFrom = feetToMeters(f.properties.altitude_from_ft)
      const altTo = feetToMeters(f.properties.altitude_to_ft)
      const ring = f.geometry.coordinates[0] as [number, number][]
      const flat: number[] = []
      for (const [lon, lat] of ring) flat.push(lon, lat)

      const ent = viewer.entities.add({
        id: `sector:${name}`,
        show: false,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat)),
          height: altFrom,
          extrudedHeight: altTo,
          material: Cesium.Color.fromBytes(34, 197, 94, 60),
          closeTop: true,
          closeBottom: true,
        },
        properties: { sectorName: name },
      })
      entities.set(name, ent)
    }

    built = true

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: import('cesium').Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position)
      const name = picked?.id?.properties?.sectorName?.getValue?.()
      if (name) onSelect(name)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    // Frame the contiguous US. setView is instant + deterministic (no RAF
    // dependency), then a short flyTo adds a gentle settle for live use.
    const conus = Cesium.Rectangle.fromDegrees(-128, 23, -66, 50)
    viewer.camera.setView({ destination: conus })
    viewer.camera.flyTo({ destination: conus, duration: 1.0 })
  }

  function recolor(state: RecolorState) {
    if (!Cesium) return
    for (const [name, ent] of entities) {
      const s = state.sectorMap.get(name)
      if (!ent.polygon) continue
      if (!s) { ent.show = false; continue }

      const bandOk = state.band === 'ALL' || s.band === state.band
      const counts = state.mode === 'mitigated' && s.counts_mitigated ? s.counts_mitigated : s.counts
      const count = counts[state.binIndex] ?? 0

      // Declutter: only render sectors that actually hold traffic at this bin.
      if (!bandOk || count <= 0) { ent.show = false; continue }
      ent.show = true

      const ratio = s.capacity ? count / s.capacity : 0
      const over = ratio > 1
      const { r, g, b } = heatRgb(ratio)
      const isSelected = state.selected === name
      const alpha = isSelected ? 0.7 : over ? 0.55 : 0.3
      ent.polygon.material = new Cesium.ColorMaterialProperty(
        Cesium.Color.fromBytes(r, g, b, Math.round(alpha * 255)),
      )
      ent.polygon.outline = isSelected as any
      if (isSelected) ent.polygon.outlineColor = Cesium.Color.fromBytes(34, 211, 238, 255) as any
    }
  }

  function destroy() {
    handler?.destroy()
    handler = null
    entities.clear()
    built = false
  }

  return { build, recolor, destroy, isBuilt: () => built }
}
