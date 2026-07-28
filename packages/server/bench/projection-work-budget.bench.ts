/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Measure representative live-projection snapshot sizes without mutating a project.
 * 2. Record the configured Projection Work resource and cache budgets beside observed single-flight behavior.
 * 3. Produce machine-readable P1 evidence rather than a machine-dependent performance gate.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { ConfigManager, OpenSpecAdapter } from '@openspecui/core'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { loadDashboardOverview } from '../src/dashboard-overview.js'
import {
  ProjectionWorkRuntime,
  serverProjectionWorkCacheBudget,
  serverProjectionWorkResourceLimits,
} from '../src/projection-work/runtime.js'
import type { ProjectionWorkIdentity, ProjectionWorkRequest } from '../src/projection-work/types.js'

interface Measurement {
  label: string
  durationMs: number
  serializedBytes: number
}

function serializedBytes(value: unknown): number {
  const serialized = JSON.stringify(value)
  return Buffer.byteLength(serialized ?? 'null')
}

async function measure<T>(label: string, task: () => Promise<T>): Promise<Measurement> {
  const started = performance.now()
  const value = await task()
  return {
    label,
    durationMs: Number((performance.now() - started).toFixed(2)),
    serializedBytes: serializedBytes(value),
  }
}

function projectionIdentity(): ProjectionWorkIdentity {
  return {
    projectionKind: 'benchmark-single-flight',
    planningRoot: {
      identity: 'benchmark-root',
      source: 'benchmark',
      storeSelector: null,
    },
    owner: {
      generation: 'benchmark-generation',
      gitBindingToken: null,
    },
    selector: 'same-input',
    inputFingerprint: 'benchmark-input-v1',
    protocolVersion: 1,
  }
}

const rawArgs = hideBin(process.argv).filter((arg) => arg !== '--')
const cliArgs = rawArgs[0]?.endsWith('.bench.ts') ? rawArgs.slice(1) : rawArgs
const argv = await yargs(cliArgs)
  .option('dir', {
    alias: 'd',
    describe: 'Planning project to measure',
    type: 'string',
    default: '.',
  })
  .strict()
  .parse()
const projectDir = resolve(process.cwd(), argv.dir)
const adapter = new OpenSpecAdapter(projectDir)
const configManager = new ConfigManager(projectDir)

const measurements = await Promise.all([
  measure('dashboard-overview', () =>
    loadDashboardOverview(
      {
        adapter,
        configManager,
        projectDir,
        codeBindingToken: 'projection-work-benchmark',
      },
      'projection-work-budget-benchmark'
    )
  ),
  measure('changes-with-meta', () => adapter.listChangesWithMeta()),
  measure('archived-changes-with-meta', () => adapter.listArchivedChangesWithMeta()),
])

const runtime = new ProjectionWorkRuntime()
const registry = runtime.createRegistry<string>()
let leafCalls = 0
const received: string[] = []
const request: ProjectionWorkRequest<string, never> = {
  identity: projectionIdentity(),
  resourceClass: 'filesystem',
  priority: 'foreground',
  estimateSnapshotBytes: (value) => Buffer.byteLength(value),
  load: async () => {
    leafCalls += 1
    await Promise.resolve()
    return 'shared-result'
  },
}

const first = registry.subscribe(request, (event) => {
  if (event.type === 'snapshot') received.push(`first:${event.snapshot.data}`)
})
const second = registry.subscribe(request, (event) => {
  if (event.type === 'snapshot') received.push(`second:${event.snapshot.data}`)
})
while (received.length < 2) {
  await Promise.resolve()
}
first.unsubscribe()
second.unsubscribe()

process.stdout.write(
  `${JSON.stringify(
    {
      benchmark: 'projection-work-budget',
      projectDir,
      generatedAt: new Date().toISOString(),
      configuredBudget: {
        resourceLimits: serverProjectionWorkResourceLimits,
        cache: serverProjectionWorkCacheBudget,
      },
      measurements,
      sharedWork: {
        leafCalls,
        received,
        tracePhases: runtime.phaseTrace.read().map((entry) => entry.phase),
      },
    },
    null,
    2
  )}\n`
)
runtime.clear()
