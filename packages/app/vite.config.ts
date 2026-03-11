import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { rewriteHostedBundleText } from './src/lib/bundle-rewrite'
import {
  createLocalDevManifest,
  getMimeType,
  resolveLocalDevBundleRelativePath,
} from './src/lib/dev-server'
import { hostedAppPlugin } from './src/vite-plugin-hosted-app'

function hostedAppDevPlugin(): Plugin {
  const enabled = process.env.OPENSPECUI_APP_DEV_MODE === '1'
  const localWebDist = process.env.OPENSPECUI_APP_DEV_WEB_DIST
  const localVersion = process.env.OPENSPECUI_APP_DEV_VERSION ?? '0.0.0-dev'

  return {
    name: 'openspecui-hosted-app-dev',
    apply: 'serve',
    configureServer(server) {
      if (!enabled || !localWebDist) {
        return
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) {
          next()
          return
        }

        const requestUrl = new URL(req.url, 'http://localhost')
        if (requestUrl.pathname === '/version.json') {
          const manifest = createLocalDevManifest(localVersion)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(`${JSON.stringify(manifest, null, 2)}\n`)
          return
        }

        const relativePath = resolveLocalDevBundleRelativePath(requestUrl.pathname)
        if (!relativePath) {
          next()
          return
        }

        const absolutePath = join(localWebDist, relativePath)
        if (!existsSync(absolutePath)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(
            `<main><h1>OpenSpec UI App</h1><p>Missing local web asset: <code>${relativePath}</code>.</p></main>`
          )
          return
        }

        const content = await readFile(absolutePath)
        const mimeType = getMimeType(absolutePath)
        res.setHeader('Content-Type', mimeType)
        if (mimeType.startsWith('text/') || mimeType.includes('javascript')) {
          res.end(rewriteHostedBundleText(content.toString('utf8'), 'latest'))
          return
        }
        res.end(content)
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
