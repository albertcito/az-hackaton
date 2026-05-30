import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const source = join(process.cwd(), 'node_modules/cesium/Build/Cesium')
const target = join(process.cwd(), 'public/cesium')

if (!existsSync(source)) {
  console.warn('[copy-cesium] Cesium package not found, skipping')
  process.exit(0)
}

cpSync(source, target, { recursive: true })
console.log('[copy-cesium] Copied Cesium assets to public/cesium')
