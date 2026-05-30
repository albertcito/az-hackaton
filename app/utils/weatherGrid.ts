export const WX_ROWS = 256
export const WX_COLS = 358
export const WX_LAT_MIN = 21.943
export const WX_LAT_MAX = 55.7765
export const WX_LON_MIN = -135.0
export const WX_LON_MAX = -67.5
export const REFC_NODATA = -50
export const RETOP_NODATA = 0
export const REFC_CLEAR_THRESHOLD = 40

export function latLonToGridIndex(lat: number, lon: number): { row: number, col: number } {
  const row = Math.floor((WX_LAT_MAX - lat) / (WX_LAT_MAX - WX_LAT_MIN) * WX_ROWS)
  const col = Math.floor((lon - WX_LON_MIN) / (WX_LON_MAX - WX_LON_MIN) * WX_COLS)
  return {
    row: Math.min(Math.max(row, 0), WX_ROWS - 1),
    col: Math.min(Math.max(col, 0), WX_COLS - 1)
  }
}

export function sampleMatrix(matrix: Float64Array, row: number, col: number): number {
  return matrix[row * WX_COLS + col]
}
