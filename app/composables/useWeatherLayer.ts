import { loadWeatherMatrix } from '~/utils/loadWeatherMatrix'
import { weatherStripUrl } from '~/utils/weatherStrips'
import {
  WX_COLS,
  WX_LAT_MAX,
  WX_LAT_MIN,
  WX_LON_MAX,
  WX_LON_MIN,
  WX_ROWS,
} from '~/utils/weatherGrid'
import { refcToRgba } from '~/utils/weatherColor'

// Renders the composite-reflectivity (refc) grid for the current bin as a
// translucent draped image on the globe, so the storms are visible alongside
// the sector congestion. Matrix row 0 = north, col 0 = west — maps directly to
// canvas (y, x) and a Cesium rectangle drawn top=north.
export function useWeatherLayer(getViewer: () => import('cesium').Viewer | null) {
  let Cesium: typeof import('cesium') | null = null
  let canvas: HTMLCanvasElement | null = null
  let entity: import('cesium').Entity | null = null

  function ensureCanvas(): HTMLCanvasElement {
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = WX_COLS
      canvas.height = WX_ROWS
    }
    return canvas
  }

  async function update(askedAt: string, iso: string) {
    const viewer = getViewer()
    if (!viewer || !askedAt || !iso) return
    Cesium = await import('cesium')

    const url = weatherStripUrl(askedAt, 'refc', new Date(iso).getTime())
    let matrix: Float64Array
    try {
      matrix = await loadWeatherMatrix(url)
    } catch {
      return
    }

    const cv = ensureCanvas()
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(WX_COLS, WX_ROWS)
    for (let i = 0; i < WX_ROWS * WX_COLS; i++) {
      const [r, g, b, a] = refcToRgba(matrix[i] ?? -9999)
      const o = i * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = a
    }
    ctx.putImageData(img, 0, 0)

    const material = new Cesium.ImageMaterialProperty({
      image: cv,
      transparent: true,
    })
    if (!entity) {
      entity = viewer.entities.add({
        id: 'wx-layer',
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(WX_LON_MIN, WX_LAT_MIN, WX_LON_MAX, WX_LAT_MAX),
          material,
          height: 0,
        },
      })
    } else if (entity.rectangle) {
      entity.rectangle.material = material
    }
  }

  function show(visible: boolean) {
    if (entity) entity.show = visible
  }

  function clear() {
    const viewer = getViewer()
    if (viewer && entity) viewer.entities.remove(entity)
    entity = null
  }

  return { update, show, clear }
}
