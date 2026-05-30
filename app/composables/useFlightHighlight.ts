import type { FlightWithSnapshot } from '~/types/flight'
import { interpolatePosition } from '~/utils/interpolatePosition'
import { toPosition, toRoutePositions } from '~/utils/routePositions'

// Draws one selected flight (route + live position) on the console globe, on
// top of the sector layer. Used by the hotspot drill-down.
export function useFlightHighlight(getViewer: () => import('cesium').Viewer | null) {
  let Cesium: typeof import('cesium') | null = null
  const ids = ['hl-route', 'hl-origin', 'hl-dest', 'hl-aircraft']

  function clear() {
    const viewer = getViewer()
    if (!viewer) return
    for (const id of ids) {
      const e = viewer.entities.getById(id)
      if (e) viewer.entities.remove(e)
    }
  }

  async function draw(flight: FlightWithSnapshot, iso: string) {
    const viewer = getViewer()
    if (!viewer) return
    Cesium = await import('cesium')
    clear()

    const positions = toRoutePositions(flight, Cesium.Cartesian3.fromDegrees) as import('cesium').Cartesian3[]
    viewer.entities.add({
      id: 'hl-route',
      polyline: { positions, width: 3, material: Cesium.Color.fromBytes(34, 211, 238, 235) },
    })
    viewer.entities.add({
      id: 'hl-origin',
      position: positions[0],
      point: { pixelSize: 7, color: Cesium.Color.fromBytes(34, 197, 94, 255) },
    })
    viewer.entities.add({
      id: 'hl-dest',
      position: positions[positions.length - 1],
      point: { pixelSize: 7, color: Cesium.Color.fromBytes(251, 146, 60, 255) },
    })

    const p = interpolatePosition(flight, iso)
    viewer.entities.add({
      id: 'hl-aircraft',
      position: toPosition(Cesium.Cartesian3.fromDegrees, p.lat, p.lon, p.altFt) as import('cesium').Cartesian3,
      point: {
        pixelSize: 11,
        color: Cesium.Color.fromBytes(34, 211, 238, 255),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: flight.flight_number,
        font: 'bold 12px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -18),
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromBytes(11, 18, 32, 210),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
      },
    })
  }

  function setTime(flight: FlightWithSnapshot, iso: string) {
    const viewer = getViewer()
    if (!viewer || !Cesium) return
    const e = viewer.entities.getById('hl-aircraft')
    if (!e) return
    const p = interpolatePosition(flight, iso)
    e.position = new Cesium.ConstantPositionProperty(
      toPosition(Cesium.Cartesian3.fromDegrees, p.lat, p.lon, p.altFt) as import('cesium').Cartesian3,
    )
  }

  return { draw, setTime, clear }
}
