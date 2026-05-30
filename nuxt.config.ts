import { join } from 'node:path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const cesiumSource = join(process.cwd(), 'node_modules/cesium/Build/Cesium')
const cesiumBundle = join(cesiumSource, 'index.js')
const cesiumBaseUrl = 'cesium'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    routesSnapshotDir: process.env.NUXT_ROUTES_SNAPSHOT || 'asked_at_2026-04-08T18:00:00Z',
    public: {
      cesiumIonToken: process.env.NUXT_PUBLIC_CESIUM_ION_TOKEN || ''
    }
  },
  vite: {
    resolve: {
      alias: [
        {
          // Only alias the root import — subpaths like cesium/Build/.../widgets.css must still resolve normally
          find: /^cesium$/,
          replacement: cesiumBundle
        }
      ]
    },
    plugins: [
      viteStaticCopy({
        targets: [
          { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
          { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl }
        ]
      })
    ],
    define: {
      CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`)
    },
    optimizeDeps: {
      exclude: ['cesium']
    }
  }
})
