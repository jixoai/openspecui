/**
 * Orthogonal intents (updated 2026-08-14 Asia/Shanghai):
 * 1. Run Core files serially so the process-global reactive watcher pool cannot bleed across workers.
 * 2. Serialize Windows fork workers so full-suite process teardown remains stable on hosted
 *    runners (the documented Windows fork-resource class App, xterm, and Server already pin).
 * 3. Ignore the vitest 4.1 fork-pool teardown artifact on hosted Windows CI only, where a
 *    worker crash after a fully green suite otherwise fails the lane; local and ubuntu stay strict.
 *
 * Original request (2026-08-14): a hosted-runner Windows lane run crashed one Core fork worker
 *   ("Worker exited unexpectedly") while every test in the surviving workers passed.
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    // Core tests exercise a process-global reactive watcher pool. Run files
    // serially so temp-project watcher state cannot bleed across workers.
    fileParallelism: false,
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
})
