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
    // Demo snapshot: strong congestion AND weather-driven over-demand (e.g. LOW_096
    // 38/20 with 100% weather-displaced bins). Colons ok here (sanitized on read).
    routesSnapshotDir: process.env.NUXT_ROUTES_SNAPSHOT || 'asked_at_2025-08-21T18:00:00Z',
    public: {
      cesiumIonToken: process.env.NUXT_PUBLIC_CESIUM_ION_TOKEN || '',
      // Sanitized (colon-free) id the console opens on by default.
      demoSnapshot: process.env.NUXT_PUBLIC_DEMO_SNAPSHOT || 'asked_at_2025-08-21T18-00-00Z'
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
