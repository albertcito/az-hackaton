import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

type Band = 'HIGH' | 'LOW'

interface RawFeature {
  geometry: { type: string, coordinates: number[][][] }
  properties: {
    name: string
    altitude_from_ft: number
    altitude_to_ft: number
    capacity: number
  }
}

export interface IndexedSector {
  name: string
  band: Band
  altitudeFromFt: number
  altitudeToFt: number
  capacity: number
  /** Polygon rings as [lon, lat]; ring 0 is the exterior, the rest are holes. */
  coordinates: number[][][]
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

let high: IndexedSector[] | null = null
let low: IndexedSector[] | null = null

async function loadSectors(): Promise<void> {
  if (high && low) return

  const filePath = join(process.cwd(), 'sectors.geojson')
  const raw = await readFile(filePath, 'utf-8')
  const data = JSON.parse(raw) as { features: RawFeature[] }

  high = []
  low = []
  for (const feature of data.features) {
    const props = feature.properties
    const band: Band = props.name.startsWith('HIGH') ? 'HIGH' : 'LOW'
    const coordinates = feature.geometry.coordinates

    let minLon = Infinity
    let minLat = Infinity
    let maxLon = -Infinity
    let maxLat = -Infinity
    for (const [lon, lat] of coordinates[0]) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }

    const sector: IndexedSector = {
      name: props.name,
      band,
      altitudeFromFt: props.altitude_from_ft,
      altitudeToFt: props.altitude_to_ft,
      capacity: props.capacity,
      coordinates,
      minLon,
      minLat,
      maxLon,
      maxLat
    }
    ;(band === 'HIGH' ? high : low).push(sector)
  }
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** True if (lat, lon) is inside the polygon exterior ring and outside every hole. */
export function pointInSector(lat: number, lon: number, sector: IndexedSector): boolean {
  if (lon < sector.minLon || lon > sector.maxLon || lat < sector.minLat || lat > sector.maxLat) {
    return false
  }
  if (!pointInRing(lon, lat, sector.coordinates[0])) return false
  for (let h = 1; h < sector.coordinates.length; h++) {
    if (pointInRing(lon, lat, sector.coordinates[h])) return false
  }
  return true
}

export function bandForAltitude(altFt: number): Band | null {
  if (altFt >= 35000 && altFt < 60000) return 'HIGH'
  if (altFt >= 0 && altFt < 35000) return 'LOW'
  return null
}

/** Find the single sector (in the altitude's band) that contains the point. */
export async function findSector(lat: number, lon: number, altFt: number): Promise<IndexedSector | null> {
  await loadSectors()
  const band = bandForAltitude(altFt)
  if (!band) return null
  const list = band === 'HIGH' ? high! : low!
  for (const sector of list) {
    if (pointInSector(lat, lon, sector)) return sector
  }
  return null
}
