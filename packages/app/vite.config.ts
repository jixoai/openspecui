import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
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

function collectHostedShellRevisionSeed(rootDir: string): string {
  const files = [
    resolve(rootDir, 'package.json'),
    ...collectFiles(resolve(rootDir, 'src')),
    ...collectFiles(resolve(rootDir, 'public')),
  ]
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(rootDir, file))
    hash.update(readFileSync(file))
  }
  return hash.digest('hex').slice(0, 12)
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      return collectFiles(fullPath)
    }
    return [fullPath]
  })
}

export default defineConfig({
  base: '/',
  define: {
    __OPENSPECUI_APP_SHELL_REVISION__: JSON.stringify(collectHostedShellRevisionSeed(__dirname)),
  },
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
