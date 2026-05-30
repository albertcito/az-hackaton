import type { FlightWithSnapshot } from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { interpolatePosition } from '~/utils/interpolatePosition'
import { toPosition, toRoutePositions } from '~/utils/routePositions'

export function useFlightRouteLayer(
  getViewer: () => import('cesium').Viewer | null,
  onSelect: (flight: FlightWithSnapshot) => void
) {
  let handler: import('cesium').ScreenSpaceEventHandler | null = null
  let activeFlight: FlightWithSnapshot | null = null

  async function clear() {
    const viewer = getViewer()
    if (!viewer) return
    handler?.destroy()
    handler = null
    viewer.entities.removeAll()
    activeFlight = null
  }

  async function draw(flight: FlightWithSnapshot) {
    await clear()
    const viewer = getViewer()
    if (!viewer) return

    const Cesium = await import('cesium')
    activeFlight = flight
    const positions = toRoutePositions(flight, Cesium.Cartesian3.fromDegrees) as import('cesium').Cartesian3[]

    viewer.entities.add({
      id: 'route',
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CYAN.withAlpha(0.9)
      },
      properties: { flightId: buildFlightId(flight) }
    })

    viewer.entities.add({
      id: 'origin',
      position: positions[0],
      point: { pixelSize: 10, color: Cesium.Color.LIME },
      label: { text: flight.origin_airport_icao, font: '12px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -16) }
    })

    viewer.entities.add({
      id: 'destination',
      position: positions[positions.length - 1],
      point: { pixelSize: 10, color: Cesium.Color.ORANGE },
      label: { text: flight.destination_airport_icao, font: '12px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -16) }
    })

    viewer.entities.add({
      id: 'aircraft',
      position: positions[0],
      point: { pixelSize: 14, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
      label: { text: flight.flight_number, font: 'bold 13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -20) }
    })

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: import('cesium').Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position)
      if (picked?.id && activeFlight) onSelect(activeFlight)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    await viewer.flyTo(viewer.entities, { duration: 1.5 })
  }

  async function updateAircraft(flight: FlightWithSnapshot, isoTime: string) {
    const viewer = getViewer()
    if (!viewer) return

    const Cesium = await import('cesium')
    const pos = interpolatePosition(flight, isoTime)
    const entity = viewer.entities.getById('aircraft')
    if (entity) {
      entity.position = new Cesium.ConstantPositionProperty(
        toPosition(Cesium.Cartesian3.fromDegrees, pos.lat, pos.lon, pos.altFt) as import('cesium').Cartesian3
      )
    }
  }

  return { draw, clear, updateAircraft }
}
