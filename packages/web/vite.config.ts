import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'

function resolveBackendTarget(): string {
  const explicit =
    process.env.VITE_API_URL || process.env.OPENSPEC_SERVER_URL || process.env.API_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const port = process.env.OPENSPEC_SERVER_PORT || process.env.SERVER_PORT || process.env.PORT
  const targetPort = port ? Number(port) : 3100
  return `http://localhost:${targetPort}`
}

export default defineConfig(({ isSsrBuild }) => {
  const backendTarget = resolveBackendTarget()
  console.log(`[dev-proxy] backend target => ${backendTarget}`)

  // Always use base: '/' - base path is now configured at runtime via window.__OPENSPEC_BASE_PATH__
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@openspecui/core': resolve(__dirname, '../core/src'),
        '@openspecui/server': resolve(__dirname, '../server/src'),
      },
    },
    server: {
      port: 13003,
      proxy: {
        '/trpc': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/ws/pty': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    ssr: {
      // SSR build: bundle all dependencies into entry-server.js
      // This eliminates runtime dependencies for the SSG CLI
      noExternal: isSsrBuild ? true : [],
    },
  }
})
