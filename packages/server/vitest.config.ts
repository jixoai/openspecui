/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Keep Server Vitest file-level execution serial so stubbed fetch and real runtime servers
 *    cannot bleed across files.
 * 2. Serialize Windows fork workers so full-suite process teardown remains stable on hosted
 *    runners (the documented Windows fork/Chromium resource class that App already pins).
 * 3. Fail loudly on unhandled teardown errors everywhere: the previous CI-only
 *    dangerouslyIgnoreUnhandledErrors swallowed the chronic "Worker exited unexpectedly"
 *    teardown artifact instead of surfacing its resource evidence.
 *
 * Original request (2026-08-14): first hosted-runner Windows lane runs crashed one Server fork
 *   worker ("Worker exited unexpectedly") while every test in the surviving workers passed.
 * Original request (2026-08-19): "任务内自动重试"这个方案属于浪费资源隐藏问题，尽量不做 — hidden
 *   failures are the same class of problem as retries.
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Server tests stub process-global fetch and run real ports; keep file-level
    // execution serial so mocks and runtime servers cannot bleed across files.
    fileParallelism: false,
    pool: 'forks',
    ...(process.platform === 'win32' ? { maxWorkers: 1 } : {}),
  },
  resolve: {
    alias: {
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/search': resolve(__dirname, '../search/src'),
      '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
    },
  },
})
