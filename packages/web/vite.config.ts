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
  const alias = {
    '@': resolve(__dirname, './src'),
    '@openspecui/core': resolve(__dirname, '../core/src'),
    '@openspecui/core/pty-protocol': resolve(__dirname, '../core/src/pty-protocol.ts'),
    '@openspecui/server': resolve(__dirname, '../server/src'),
  }
  console.log(`[dev-proxy] backend target => ${backendTarget}`)

  // Always use base: '/' - base path is now configured at runtime via window.__OPENSPEC_BASE_PATH__
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias,
    },
    server: {
      port: 13003,
      hmr: {
        // 关键：可以尝试指定一个专门的端口给 HMR 使用，避开 13003 的业务代理冲突
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
        // Unit tests (React components, pure logic) — jsdom
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
        // Storybook browser tests — separate config file
        './vitest.storybook.config.ts',
      ],
    },
    ssr: {
      // SSR build: bundle all dependencies into entry-server.js
      // This eliminates runtime dependencies for the SSG CLI
      noExternal: isSsrBuild ? true : [],
    },
  }
})
