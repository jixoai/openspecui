/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Configure hosted App, PWA, CLI runtime projection, and development endpoints.
 * 2. Resolve browser-safe workspace source entries, including the Store mutation protocol.
 * 3. Generate platform-native App identity assets from the canonical brand symbol.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Owner direction (2026-07-29): the bundled App consumes the shared daemon control contract.
 * Owner correction (2026-07-30): every App build projects its assets into the CLI package.
 * Owner correction (2026-07-30): App identity assets are owned by openTrayAppIconPlugin.
 */
import { openTrayAppIconPlugin } from '@opentray/vite-plugin'
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
  plugins: [
    openTrayAppIconPlugin({
      sourcePath: resolve(__dirname, 'public/icon.svg'),
      outputPath: resolve(__dirname, 'public/native-icons/app-icon.png'),
      icnsOutputPath: resolve(__dirname, 'public/native-icons/app-icon.icns'),
      icoOutputPath: resolve(__dirname, 'public/native-icons/app-icon.ico'),
      linuxOutputDirectory: resolve(__dirname, 'public/native-icons/linux'),
      manifestOutputPath: resolve(__dirname, 'public/native-icons/app-icon.json'),
      cachePath: resolve(__dirname, 'node_modules/.cache/opentray/app-icon.json'),
    }),
    react(),
    tailwindcss(),
    hostedAppDevPlugin(),
    hostedAppPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
      '@openspecui/core/app-daemon-control': resolve(
        __dirname,
        '../core/src/app-daemon-control.ts'
      ),
      '@openspecui/core/store-types': resolve(__dirname, '../core/src/store-types.ts'),
      '@openspecui/core/store-mutation-protocol': resolve(
        __dirname,
        '../core/src/store-mutation-protocol.ts'
      ),
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
