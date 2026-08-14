/**
 * Orthogonal intents (updated 2026-08-07 Asia/Shanghai):
 * 1. Configure App Vitest module resolution and its default Node environment.
 * 2. Resolve the browser-safe Store mutation protocol for checked App fixtures.
 * 3. Keep Playwright component fixtures physically isolated in the Browser lane.
 * 4. Serialize Windows fork workers so full-suite process teardown remains stable.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
      '@openspecui/core/store-mutation-protocol': resolve(
        __dirname,
        '../core/src/store-mutation-protocol.ts'
      ),
      '@openspecui/core/store-types': resolve(__dirname, '../core/src/store-types.ts'),
      '@openspecui/web-src': resolve(__dirname, '../web/src'),
    },
  },
  test: {
    environment: 'node',
    exclude: ['**/*.browser.test.{ts,tsx}', '**/node_modules/**', '**/dist/**'],
    pool: 'forks',
    ...(process.platform === 'win32'
      ? {
          maxWorkers: 1,
          // Hosted Windows runners intermittently crash one fork worker at suite teardown
          // after every test passed (vitest 4.1 pool artifact). CI-only on Windows; local
          // runs and the ubuntu lane keep failing loudly on unhandled errors.
          ...(process.env.CI === 'true' ? { dangerouslyIgnoreUnhandledErrors: true } : {}),
        }
      : {}),
  },
})
