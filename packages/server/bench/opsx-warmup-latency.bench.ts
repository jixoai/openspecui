/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure the real OPSX kernel warmup that runs beside live page subscriptions.
 * 2. Bound an incomplete warmup as evidence instead of allowing an unobserved hanging promise.
 * 3. Report resulting Schema, Change, and Status projection cardinalities without mutations.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { CliExecutor, ConfigManager, OpsxKernel, RuntimeInvalidationIndex } from '@openspecui/core'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

interface BenchArgs {
  dir: string
  timeout: number
}

function timeoutAfter(milliseconds: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${milliseconds}ms.`)), milliseconds)
  })
}

const rawArgs = hideBin(process.argv).filter((arg) => arg !== '--')
// tsx retains its executed .bench.ts path in argv; yargs must only receive user arguments.
const cliArgs = rawArgs[0]?.endsWith('.bench.ts') ? rawArgs.slice(1) : rawArgs
const argv = (await yargs(cliArgs)
  .option('dir', {
    alias: 'd',
    describe: 'Planning project to measure',
    type: 'string',
    default: '.',
  })
  .option('timeout', {
    describe: 'Maximum warmup wait in milliseconds',
    type: 'number',
    default: 20_000,
  })
  .strict()
  .parse()) as BenchArgs
const projectDir = resolve(process.cwd(), argv.dir)

const configManager = new ConfigManager(projectDir)
const cliExecutor = new CliExecutor(configManager, projectDir)
const kernel = new OpsxKernel(projectDir, cliExecutor, new RuntimeInvalidationIndex(), {})
const started = performance.now()
let outcome: 'ok' | 'timeout-or-error' = 'ok'
let error: string | null = null

try {
  await Promise.race([kernel.warmup(), timeoutAfter(argv.timeout)])
} catch (cause) {
  outcome = 'timeout-or-error'
  error = cause instanceof Error ? cause.message : String(cause)
} finally {
  kernel.dispose()
}

process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'opsx-warmup-latency',
      projectDir,
      generatedAt: new Date().toISOString(),
      durationMs: Number((performance.now() - started).toFixed(2)),
      outcome,
      error,
      schemas: kernel.getSchemas().length,
      changes: kernel.getChangeIds().length,
      statuses: kernel.getStatusList().length,
    },
    null,
    2
  )}\n`
)
