import type { SectorTraffic } from '~/types/sector'
import { feetToMeters } from '~/utils/interpolatePosition'

const FLIGHT_PREFIX = 'cosector-'
const BOUNDARY_ID = 'sector-boundary'
const ALWAYS_VISIBLE = Number.POSITIVE_INFINITY

/**
 * Draws the selected flight's sector boundary plus a marker for every other
 * flight currently inside it. Entities are namespaced so they can be cleared
 * without disturbing the main route layer (which calls `entities.removeAll`).
 */
export function useSectorTrafficLayer(getViewer: () => import('cesium').Viewer | null) {
  function clear() {
    const viewer = getViewer()
    if (!viewer) return
    const stale = viewer.entities.values.filter((entity) => {
      const id = entity.id
      return typeof id === 'string' && (id === BOUNDARY_ID || id.startsWith(FLIGHT_PREFIX))
    })
    for (const entity of stale) viewer.entities.remove(entity)
  }

  async function render(traffic: SectorTraffic | null) {
    const viewer = getViewer()
    if (!viewer) return
    clear()
    if (!traffic?.sector) return

    const Cesium = await import('cesium')
    const accent = traffic.overDemand ? Cesium.Color.RED : Cesium.Color.ORANGE
    const floorM = feetToMeters(traffic.sector.altitudeFromFt)

    const ring: number[] = []
    for (const [lon, lat] of traffic.sector.boundary) ring.push(lon, lat)

    viewer.entities.add({
      id: BOUNDARY_ID,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(ring),
        height: floorM,
        material: accent.withAlpha(0.12),
        outline: true,
        outlineColor: accent.withAlpha(0.9),
        outlineWidth: 2
      }
    })

    for (const other of traffic.others) {
      viewer.entities.add({
        id: FLIGHT_PREFIX + other.id,
        position: Cesium.Cartesian3.fromDegrees(other.lon, other.lat, feetToMeters(other.altFt)),
        point: {
          pixelSize: 9,
          color: accent,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: ALWAYS_VISIBLE
        },
        label: {
          text: other.flightNumber,
          font: '11px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -14),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: ALWAYS_VISIBLE
        }
      })
    }
  }

  return { render, clear }
}
