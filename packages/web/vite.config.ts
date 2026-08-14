/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Configure Project Web build, aliases, tests, and development backend proxies.
 * 2. Emit preview entrypoints and one stable Access Gate resource-worker entrypoint.
 * 3. Keep build-projection tests inside the default unit-test topology.
 * 4. On hosted Windows CI only, ignore the vitest 4.1 fork-pool teardown artifact that kills
 *    otherwise fully green unit runs; local runs and the ubuntu lane stay strict.
 *
 * Original request (2026-08-14): first Windows lane runs crashed one fork worker at teardown.
 * Original request (2026-07-24): "完整审计 Project Web 的 HTTP/tRPC WS/PTY/raw resource 网络路径。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createCliWebSyncPlugin } from './vite.sync-cli-web'
import { resolveWebUnitMaxWorkers } from './vite.test-workers'

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
    '@openspecui/core/dashboard-display': resolve(__dirname, '../core/src/dashboard-display.ts'),
    '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
    '@openspecui/core/hosted-contract': resolve(__dirname, '../core/src/hosted-contract.ts'),
    '@openspecui/core/planning-cli-projection': resolve(
      __dirname,
      '../core/src/planning-cli-projection.ts'
    ),
    '@openspecui/core/translation-language-pair': resolve(
      __dirname,
      '../core/src/translation-language-pair.ts'
    ),
    '@openspecui/core/notifications': resolve(__dirname, '../core/src/notifications.ts'),
    '@openspecui/core/openspec-compat': resolve(__dirname, '../core/src/openspec-compat.ts'),
    '@openspecui/core/opsx-display-path': resolve(__dirname, '../core/src/opsx-display-path.ts'),
    '@openspecui/core/opsx-workflows': resolve(__dirname, '../core/src/opsx-workflows.ts'),
    '@openspecui/core/opsx-entity': resolve(__dirname, '../core/src/opsx-entity.ts'),
    '@openspecui/core/opsx-schema-detail': resolve(__dirname, '../core/src/opsx-schema-detail.ts'),
    '@openspecui/core/task-progress': resolve(__dirname, '../core/src/task-progress.ts'),
    '@openspecui/core/spec-catalog': resolve(__dirname, '../core/src/spec-catalog.ts'),
    '@openspecui/core/pty-protocol': resolve(__dirname, '../core/src/pty-protocol.ts'),
    '@openspecui/core/sounds': resolve(__dirname, '../core/src/sounds.ts'),
    '@openspecui/core/terminal-invocation': resolve(
      __dirname,
      '../core/src/terminal-invocation.ts'
    ),
    '@openspecui/core/terminal-audio': resolve(__dirname, '../core/src/terminal-audio.ts'),
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
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          'image-preview': resolve(__dirname, 'image-preview.html'),
          'audio-preview': resolve(__dirname, 'audio-preview.html'),
          'video-preview': resolve(__dirname, 'video-preview.html'),
          'pdf-preview': resolve(__dirname, 'pdf-preview.html'),
          'access-gate-resource-worker': resolve(__dirname, 'src/access-gate-resource-worker.ts'),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'access-gate-resource-worker'
              ? 'access-gate-resource-worker.js'
              : 'assets/[name]-[hash].js',
        },
      },
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
            maxWorkers: resolveWebUnitMaxWorkers(),
            environment: 'jsdom',
            setupFiles: './src/test/setup.ts',
            include: [
              'src/**/*.test.{ts,tsx}',
              'vite.sync-cli-web.test.ts',
              'vite.test-workers.test.ts',
            ],
            exclude: ['src/**/*.browser.test.{ts,tsx}'],
            // Hosted Windows runners intermittently crash one fork worker at suite teardown
            // after every test passed (vitest 4.1 pool artifact). CI-only on Windows; local
            // runs and the ubuntu lane keep failing loudly on unhandled errors.
            ...(process.platform === 'win32' && process.env.CI === 'true'
              ? { dangerouslyIgnoreUnhandledErrors: true }
              : {}),
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
