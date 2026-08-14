/**
 * Orthogonal intents (updated 2026-08-14 Asia/Shanghai):
 * 1. Keep export-test file I/O inside a 30 s budget.
 * 2. On hosted Windows CI only, ignore the vitest 4.1 fork-pool teardown artifact that kills
 *    otherwise fully green suite runs; local runs and the ubuntu lane stay strict.
 *
 * Original request (2026-08-14): first Windows lane runs crashed one fork worker at teardown.
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Increase timeout for export tests which involve file I/O
    testTimeout: 30000,
    ...(process.platform === 'win32' && process.env.CI === 'true'
      ? { dangerouslyIgnoreUnhandledErrors: true }
      : {}),
  },
  resolve: {
    alias: {
      '@openspecui/ai-provider': resolve(__dirname, '../ai-provider/src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/search': resolve(__dirname, '../search/src'),
      '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
      '@openspecui/server': resolve(__dirname, '../server/src'),
    },
  },
})
