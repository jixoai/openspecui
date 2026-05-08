import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { createHostedAppPwaManifest } from './src/lib/pwa-manifest'
import { hostedAppPlugin } from './src/vite-plugin-hosted-app'

function hostedAppDevPlugin(): Plugin {
  return {
    name: 'openspecui-hosted-app-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) {
          next()
          return
        }

        const requestUrl = new URL(req.url, 'http://localhost')
        if (requestUrl.pathname === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
          res.end(`${JSON.stringify(createHostedAppPwaManifest(), null, 2)}\n`)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), hostedAppDevPlugin(), hostedAppPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
      '@openspecui/web-src': resolve(__dirname, '../web/src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 13005,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        'service-worker': resolve(__dirname, 'src/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
