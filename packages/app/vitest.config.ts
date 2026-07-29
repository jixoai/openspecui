/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Configure App Vitest module resolution and its default Node environment.
 * 2. Resolve the browser-safe Store mutation protocol for checked App fixtures.
 * 3. Keep Playwright component fixtures physically isolated in the Browser lane.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
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
  },
})
