import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createCliWebSyncPlugin } from './vite.sync-cli-web'

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
  const alias = {
    '@': resolve(__dirname, './src'),
    '@openspecui/core': resolve(__dirname, '../core/src'),
    '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
    '@openspecui/core/opsx-display-path': resolve(__dirname, '../core/src/opsx-display-path.ts'),
    '@openspecui/core/pty-protocol': resolve(__dirname, '../core/src/pty-protocol.ts'),
    '@openspecui/search': resolve(__dirname, '../search/src'),
    '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
    '@openspecui/server': resolve(__dirname, '../server/src'),
  }
  console.log(`[dev-proxy] backend target => ${backendTarget}`)

  return {
    base: '/',
    plugins: [react(), tailwindcss(), createCliWebSyncPlugin(__dirname)],
    resolve: {
      alias,
    },
    server: {
      port: 13003,
      hmr: {
        port: 13004,
        protocol: 'ws',
      },
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
      projects: [
        {
          resolve: {
            alias,
          },
          test: {
            name: 'unit',
            environment: 'jsdom',
            setupFiles: './src/test/setup.ts',
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        './vitest.storybook.config.ts',
      ],
    },
    ssr: {
      noExternal: isSsrBuild ? true : [],
    },
  }
})
