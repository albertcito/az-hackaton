import type { FlightWithSnapshot } from '~/types/flight'
import { buildFlightId } from '~/utils/flightId'
import { interpolatePosition } from '~/utils/interpolatePosition'
import { toPosition, toRoutePositions } from '~/utils/routePositions'

const ROUTE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa']

function hubPosition(flights: FlightWithSnapshot[], icao: string): { lat: number, lon: number } | null {
  for (const flight of flights) {
    if (flight.origin_airport_icao === icao) {
      return { lat: flight.lats[0], lon: flight.lons[0] }
    }
    if (flight.destination_airport_icao === icao) {
      const last = flight.lats.length - 1
      return { lat: flight.lats[last], lon: flight.lons[last] }
    }
  }
  return null
}

function isInFlight(flight: FlightWithSnapshot, isoTime: string): boolean {
  const timeMs = new Date(isoTime).getTime()
  return (
    timeMs >= new Date(flight.take_off_time).getTime()
    && timeMs <= new Date(flight.scheduled_landing_time).getTime()
  )
}

export function useFlightTimelineLayer(getViewer: () => import('cesium').Viewer | null) {
  let flights: FlightWithSnapshot[] = []
  let hubIcao = ''
  let selectedId: string | null = null

  async function clear() {
    const viewer = getViewer()
    if (!viewer) return
    viewer.entities.removeAll()
    flights = []
    hubIcao = ''
    selectedId = null
  }

  async function draw(allFlights: FlightWithSnapshot[], airport: string) {
    await clear()
    const viewer = getViewer()
    if (!viewer || !allFlights.length) return

    const Cesium = await import('cesium')
    flights = allFlights
    hubIcao = airport

    const hub = hubPosition(flights, airport)
    if (hub) {
      viewer.entities.add({
        id: 'hub',
        position: Cesium.Cartesian3.fromDegrees(hub.lon, hub.lat, 0),
        point: { pixelSize: 14, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        label: {
          text: airport,
          font: 'bold 13px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -20),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE
        }
      })
    }

    flights.forEach((flight, index) => {
      const flightId = buildFlightId(flight)
      const positions = toRoutePositions(flight, Cesium.Cartesian3.fromDegrees) as import('cesium').Cartesian3[]
      const color = Cesium.Color.fromCssColorString(ROUTE_COLORS[index % ROUTE_COLORS.length]).withAlpha(0.45)

      viewer.entities.add({
        id: `route-${flightId}`,
        polyline: {
          positions,
          width: 3,
          material: color
        }
      })

      viewer.entities.add({
        id: `aircraft-${flightId}`,
        position: positions[0],
        point: { pixelSize: 10, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        label: {
          text: flight.flight_number,
          font: '11px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.65),
          backgroundPadding: new Cesium.Cartesian2(6, 3)
        },
        show: false
      })
    })

    await viewer.flyTo(viewer.entities, { duration: 1.5 })
  }

  async function setSelected(flightId: string | null) {
    selectedId = flightId
    const viewer = getViewer()
    if (!viewer) return

    const Cesium = await import('cesium')

    for (const flight of flights) {
      const id = buildFlightId(flight)
      const entity = viewer.entities.getById(`route-${id}`)
      if (!entity?.polyline) continue

      const index = flights.indexOf(flight)
      const isSelected = id === flightId
      const cssColor = isSelected ? '#22d3ee' : ROUTE_COLORS[index % ROUTE_COLORS.length]
      entity.polyline.width = isSelected ? 5 : 3
      entity.polyline.material = Cesium.Color.fromCssColorString(cssColor).withAlpha(isSelected ? 0.95 : 0.45)
    }

    if (flightId) {
      const entity = viewer.entities.getById(`route-${flightId}`)
      if (entity) await viewer.flyTo(entity, { duration: 1 })
    }
  }

  async function updatePositions(isoTime: string) {
    const viewer = getViewer()
    if (!viewer) return

    const Cesium = await import('cesium')

    for (const flight of flights) {
      const flightId = buildFlightId(flight)
      const entity = viewer.entities.getById(`aircraft-${flightId}`)
      if (!entity) continue

      const active = isInFlight(flight, isoTime)
      entity.show = active

      if (!active) continue

      const pos = interpolatePosition(flight, isoTime)
      entity.position = new Cesium.ConstantPositionProperty(
        toPosition(Cesium.Cartesian3.fromDegrees, pos.lat, pos.lon, pos.altFt) as import('cesium').Cartesian3
      )
    }
  }

  return { draw, clear, setSelected, updatePositions, hubPosition: () => hubPosition(flights, hubIcao) }
}
