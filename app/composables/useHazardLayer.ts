import type { AlertRegion } from '~/types/alert'
import { feetToMeters } from '~/utils/interpolatePosition'

const NM_TO_M = 1852

// Draws the active hazard region on the globe: a sector as a translucent red
// column, a circle as a red ground ellipse.
export function useHazardLayer(getViewer: () => import('cesium').Viewer | null) {
  let Cesium: typeof import('cesium') | null = null

  function clear() {
    const v = getViewer()
    if (!v) return
    const e = v.entities.getById('hazard-region')
    if (e) v.entities.remove(e)
  }

  async function draw(region: AlertRegion | null, sectorsGeo: any) {
    const v = getViewer()
    if (!v) return
    if (!region) { clear(); return }
    Cesium = await import('cesium')
    clear()

    if (region.kind === 'sector' && sectorsGeo) {
      const f = sectorsGeo.features.find((x: any) => x.properties.name === region.ref)
      if (!f) return
      const ring = f.geometry.coordinates[0] as [number, number][]
      const flat: number[] = []
      for (const [lon, lat] of ring) flat.push(lon, lat)
      v.entities.add({
        id: 'hazard-region',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flat)),
          height: 0,
          extrudedHeight: feetToMeters(f.properties.altitude_to_ft),
          material: Cesium.Color.fromBytes(239, 68, 68, 60),
          outline: false,
        },
      })
    } else if (region.kind === 'circle' && region.lat != null && region.lon != null) {
      v.entities.add({
        id: 'hazard-region',
        position: Cesium.Cartesian3.fromDegrees(region.lon, region.lat),
        ellipse: {
          semiMajorAxis: (region.radius_nm ?? 60) * NM_TO_M,
          semiMinorAxis: (region.radius_nm ?? 60) * NM_TO_M,
          material: Cesium.Color.fromBytes(239, 68, 68, 55),
          outline: true,
          outlineColor: Cesium.Color.fromBytes(248, 113, 113, 220),
          height: 0,
        },
      } as any)
    }
  }

  return { draw, clear }
}
