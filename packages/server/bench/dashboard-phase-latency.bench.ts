/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure Dashboard loader phases against the current planning project.
 * 2. Isolate Git snapshot cost from reactive filesystem and config projections.
 * 3. Emit machine-readable evidence without starting a server or mutating project data.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { ConfigManager, OpenSpecAdapter } from '@openspecui/core'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { buildDashboardGitSnapshot } from '../src/dashboard-git-snapshot.js'
import { DashboardOverviewService } from '../src/dashboard-overview-service.js'
import { loadDashboardOverview } from '../src/dashboard-overview.js'

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

  const summary = Reflect.get(value, 'summary')
  if (typeof summary === 'object' && summary !== null) {
    const activeChanges = Reflect.get(summary, 'activeChanges')
    const specifications = Reflect.get(summary, 'specifications')
    return {
      activeChanges: typeof activeChanges === 'number' ? activeChanges : null,
      specifications: typeof specifications === 'number' ? specifications : null,
    }
  }

  const worktrees = Reflect.get(value, 'worktrees')
  if (Array.isArray(worktrees)) return { worktrees: worktrees.length }

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

function createLoaderContext(projectDir: string) {
  return {
    adapter: new OpenSpecAdapter(projectDir),
    configManager: new ConfigManager(projectDir),
    projectDir,
    codeBindingToken: 'bench-dashboard-binding',
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

await measure('dashboard.loader.cold', () =>
  loadDashboardOverview(createLoaderContext(projectDir), 'bench-loader-cold')
)
await measure('dashboard.gitSnapshot', () =>
  buildDashboardGitSnapshot({ projectDir, bindingToken: 'bench-git-binding' })
)
await Promise.all([
  measure('adapter.listSpecsWithMeta', () => new OpenSpecAdapter(projectDir).listSpecsWithMeta()),
  measure('adapter.listChangesWithMeta', () =>
    new OpenSpecAdapter(projectDir).listChangesWithMeta()
  ),
  measure('adapter.listArchivedChangesWithMeta', () =>
    new OpenSpecAdapter(projectDir).listArchivedChangesWithMeta()
  ),
  measure('config.readConfig', () => new ConfigManager(projectDir).readConfig()),
])

const cacheContext = createLoaderContext(projectDir)
const overviewService = new DashboardOverviewService((reason) =>
  loadDashboardOverview(cacheContext, `bench-service-${reason}`)
)
await measure('dashboard.service.init', () => overviewService.init())
await measure('dashboard.service.getCurrent', () => overviewService.getCurrent())
await measure('dashboard.service.refresh', () => overviewService.refresh('bench-explicit-refresh'))
overviewService.dispose()

process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'dashboard-phase-latency',
      projectDir,
      generatedAt: new Date().toISOString(),
      measurements,
    },
    null,
    2
  )}\n`
)
