/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Keep ordinary script tests parallel.
 * 2. Serialize Windows process-topology tests (WMI process-table reads, real tree kills) into a
 *    dedicated single-worker project so they cannot stampede the runner.
 *
 * Original request (2026-08-19): "这种大概率是 vitest 并发测试，导致资源冲突…做好并发隔离"
 */
export default {
  test: {
    environment: 'node',
    projects: [
      {
        // Process-topology tests read the full Win32_Process table and kill real trees;
        // concurrent execution delays WMI settlement past their bounded timeouts.
        test: {
          name: 'process-topology',
          environment: 'node',
          include: [
            'scripts/lib/dev-process-supervisor.test.ts',
            'scripts/lib/bun-process-supervisor.test.ts',
            'scripts/diagnose-cli-runner.test.mjs',
          ],
          fileParallelism: false,
          maxWorkers: 1,
          minWorkers: 1,
        },
      },
      {
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: [
            'scripts/lib/dev-process-supervisor.test.ts',
            'scripts/lib/bun-process-supervisor.test.ts',
            'scripts/diagnose-cli-runner.test.mjs',
          ],
        },
      },
    ],
  },
}
