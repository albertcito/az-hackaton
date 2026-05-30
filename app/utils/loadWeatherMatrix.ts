import { unzipSync } from 'fflate'
import { load } from 'npyjs'

const matrixCache = new Map<string, Float64Array>()
const loadPromises = new Map<string, Promise<Float64Array>>()

export async function loadWeatherMatrix(url: string): Promise<Float64Array> {
  const cached = matrixCache.get(url)
  if (cached) return cached

  let pending = loadPromises.get(url)
  if (!pending) {
    pending = fetchMatrix(url).then((matrix) => {
      matrixCache.set(url, matrix)
      loadPromises.delete(url)
      return matrix
    })
    loadPromises.set(url, pending)
  }

  return pending
}

async function fetchMatrix(url: string): Promise<Float64Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load weather matrix: ${url}`)

  const buffer = await response.arrayBuffer()
  const files = unzipSync(new Uint8Array(buffer))
  const npyBytes = files['matrix.npy']
  if (!npyBytes) throw new Error('matrix.npy not found in weather archive')

  const arr = await load(
    npyBytes.buffer.slice(npyBytes.byteOffset, npyBytes.byteOffset + npyBytes.byteLength)
  )
  return arr.data as Float64Array
}
