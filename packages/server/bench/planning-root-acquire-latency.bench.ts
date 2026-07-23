/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure repeated reactive Planning-root acquisition through the production Manager.
 * 2. Prove whether an unchanged root avoids or repeats CLI Root Context resolution work.
 * 3. Emit bounded command-free benchmark evidence without mutating project data.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createServer } from '../src/server.js'

interface BenchArgs {
  dir: string
  attempts: number
}

interface Measurement {
  attempt: number
  durationMs: number
  root: string | null
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
  .option('attempts', {
    describe: 'Number of sequential reactive acquisitions',
    type: 'number',
    default: 3,
  })
  .strict()
  .parse()) as BenchArgs
const projectDir = resolve(process.cwd(), argv.dir)
const server = createServer({ projectDir, enableWatcher: false })
const measurements: Measurement[] = []

try {
  for (let attempt = 1; attempt <= argv.attempts; attempt += 1) {
    const started = performance.now()
    const root = await server.planningRootServices.runReactiveOperation(
      async ({ rootContext }) => rootContext.planningRoot?.path ?? null
    )
    measurements.push({
      attempt,
      durationMs: Number((performance.now() - started).toFixed(2)),
      root,
    })
  }
} finally {
  await server.planningRootServices.dispose()
}

process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'planning-root-acquire-latency',
      projectDir,
      generatedAt: new Date().toISOString(),
      measurements,
    },
    null,
    2
  )}\n`
)
