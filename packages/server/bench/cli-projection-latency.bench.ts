/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure the production CliExecutor command latency used by live projections.
 * 2. Relate Root Context, Schema, Change Status, and Apply Instruction work to real project inputs.
 * 3. Emit machine-readable command evidence without writing project data.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { CliExecutor, ConfigManager, OpenSpecAdapter } from '@openspecui/core'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

interface BenchArgs {
  dir: string
}

interface Measurement {
  label: string
  startedAtMs: number
  durationMs: number
  outcome: 'ok' | 'error'
  result: Record<string, number | string | boolean | null>
}

const startedAt = performance.now()
const measurements: Measurement[] = []

function elapsedMs(): number {
  return Number((performance.now() - startedAt).toFixed(2))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function summarize(value: unknown): Record<string, number | string | boolean | null> {
  if (Array.isArray(value)) return { arrayLength: value.length }
  if (typeof value !== 'object' || value === null) return { valueType: typeof value }

  const success = Reflect.get(value, 'success')
  const stdout = Reflect.get(value, 'stdout')
  const exitCode = Reflect.get(value, 'exitCode')
  if (typeof success === 'boolean') {
    return {
      success,
      stdoutBytes: typeof stdout === 'string' ? Buffer.byteLength(stdout) : null,
      exitCode: typeof exitCode === 'number' ? exitCode : null,
    }
  }

  const available = Reflect.get(value, 'available')
  const version = Reflect.get(value, 'version')
  if (typeof available === 'boolean') {
    return {
      available,
      version: typeof version === 'string' ? version : null,
    }
  }

  const data = Reflect.get(value, 'data')
  if (typeof data === 'object' && data !== null) {
    return { hasData: true }
  }

  return { valueType: 'object' }
}

async function measure<T>(label: string, task: () => Promise<T>): Promise<T | undefined> {
  const startedAtMs = elapsedMs()
  const started = performance.now()
  try {
    const value = await task()
    measurements.push({
      label,
      startedAtMs,
      durationMs: Number((performance.now() - started).toFixed(2)),
      outcome: 'ok',
      result: summarize(value),
    })
    return value
  } catch (error) {
    measurements.push({
      label,
      startedAtMs,
      durationMs: Number((performance.now() - started).toFixed(2)),
      outcome: 'error',
      result: { message: errorMessage(error) },
    })
    return undefined
  }
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
  .strict()
  .parse()) as BenchArgs
const projectDir = resolve(process.cwd(), argv.dir)

const configManager = new ConfigManager(projectDir)
const cliExecutor = new CliExecutor(configManager, projectDir)
const adapter = new OpenSpecAdapter(projectDir)

const changeIds = (await measure('filesystem.listChanges', () => adapter.listChanges())) ?? []
await measure('cli.checkAvailability', () => cliExecutor.checkAvailability())
await Promise.all([
  measure('cli.doctorRoot', () => cliExecutor.contracts.doctorRoot({})),
  measure('cli.context', () => cliExecutor.contracts.context({})),
])
await measure('cli.schemas', () => cliExecutor.schemas())
await Promise.all(
  changeIds.map((changeId) =>
    measure(`cli.workflowStatus:${changeId}`, () =>
      cliExecutor.contracts.workflowStatus(changeId, {})
    )
  )
)
await Promise.all(
  changeIds.map((changeId) =>
    measure(`cli.applyInstructions:${changeId}`, () =>
      cliExecutor.contracts.applyInstructions(changeId, {})
    )
  )
)

process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'cli-projection-latency',
      projectDir,
      generatedAt: new Date().toISOString(),
      changeIds,
      measurements,
    },
    null,
    2
  )}\n`
)
