/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Measure real WebSocket wake-to-pull first-renderable latency for Root Context, Dashboard, Changes, and selector-exact OPSX projections.
 * 2. Compare fresh-server cold starts with a fresh-client Dashboard reload on the same Server.
 * 3. Reproduce route admission order by starting lower-priority OPSX work after primary content.
 * 4. Emit bounded, machine-readable phase evidence without mutating project data.
 * 5. Keep lifecycle wake subscriptions alive until their typed Pull yields renderable data or exact error evidence.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import type {
  CliProjectionNotice,
  CliProjectionState,
  DashboardSummaryInvalidation,
  DashboardSummaryRead,
  PlanningCliProjectionSelector,
  PlanningCliProjectionState,
  RootContextResolvedState,
} from '@openspecui/core'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import WebSocket from 'ws'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startServer, type AppRouter, type RunningServer } from '../src/server.js'
import { assertMatchingDashboardSummaryRead } from './live-projection-loading-summary.js'

interface BenchArgs {
  dir: string
  port: number
  timeout: number
  scenario:
    | 'all'
    | 'transport'
    | 'dashboard'
    | 'dashboard-page'
    | 'config'
    | 'status'
    | 'changes'
    | 'changes-page'
}

interface Measurement {
  phase: string
  label: string
  startedAtMs: number
  durationMs: number
  outcome: 'ok' | 'error' | 'timeout'
  result: Record<string, number | string | boolean | null>
}

interface Unsubscribable {
  unsubscribe(): void
}

interface SubscriptionCallbacks<T> {
  onData(value: T): void
  onError(error: Error): void
}

type SubscriptionObservation<T> = (value: T, startedAtMs: number, started: number) => void

const startedAt = performance.now()
const measurements: Measurement[] = []

function elapsedMs(): number {
  return Number((performance.now() - startedAt).toFixed(2))
}

function summarizeResult(value: unknown): Record<string, number | string | boolean | null> {
  if (Array.isArray(value)) return { arrayLength: value.length }
  if (typeof value !== 'object' || value === null) return { valueType: typeof value }

  const eventType = Reflect.get(value, 'type')
  if (typeof eventType === 'string') {
    const snapshot = Reflect.get(value, 'snapshot')
    if (typeof snapshot === 'object' && snapshot !== null) {
      const freshness = Reflect.get(snapshot, 'freshness')
      const data = Reflect.get(snapshot, 'data')
      return {
        eventType,
        freshness: typeof freshness === 'string' ? freshness : null,
        ...summarizeResult(data),
      }
    }
    if (eventType === 'batch') {
      const batch = Reflect.get(value, 'batch')
      const progress = Reflect.get(value, 'progress')
      const rows =
        typeof batch === 'object' && batch !== null && Array.isArray(Reflect.get(batch, 'rows'))
          ? Reflect.get(batch, 'rows')
          : []
      const completed =
        typeof progress === 'object' && progress !== null
          ? Reflect.get(progress, 'completed')
          : null
      const total =
        typeof progress === 'object' && progress !== null ? Reflect.get(progress, 'total') : null
      return {
        eventType,
        batchRows: rows.length,
        completed: typeof completed === 'number' ? completed : null,
        total: typeof total === 'number' || typeof total === 'string' ? total : null,
      }
    }
  }

  if ('summary' in value) {
    const summary = value.summary
    if (typeof summary === 'object' && summary !== null) {
      const activeChanges = Reflect.get(summary, 'activeChanges')
      const specifications = Reflect.get(summary, 'specifications')
      return {
        activeChanges: typeof activeChanges === 'number' ? activeChanges : null,
        specifications: typeof specifications === 'number' ? specifications : null,
      }
    }
  }

  const rootState = Reflect.get(value, 'state')
  return { state: typeof rootState === 'string' ? rootState : 'object' }
}

function record(
  phase: string,
  label: string,
  startedAtMs: number,
  started: number,
  outcome: Measurement['outcome'],
  result: Measurement['result']
): void {
  measurements.push({
    phase,
    label,
    startedAtMs,
    durationMs: Number((performance.now() - started).toFixed(2)),
    outcome,
    result,
  })
}

function firstPayload<T>(
  phase: string,
  label: string,
  timeoutMs: number,
  subscribe: (callbacks: SubscriptionCallbacks<T>) => Unsubscribable,
  isRenderable: (value: T) => boolean = () => true,
  observe?: SubscriptionObservation<T>
): Promise<T> {
  const startedAtMs = elapsedMs()
  const started = performance.now()

  return new Promise<T>((resolvePromise, rejectPromise) => {
    let settled = false
    let subscription: Unsubscribable | null = null
    const settle = (
      outcome: Measurement['outcome'],
      result: Measurement['result'],
      value?: T,
      error?: Error
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      subscription?.unsubscribe()
      record(phase, label, startedAtMs, started, outcome, result)
      if (error) {
        rejectPromise(error)
      } else if (value !== undefined) {
        resolvePromise(value)
      } else {
        rejectPromise(new Error(`Subscription ${label} settled without a payload.`))
      }
    }
    const timeout = setTimeout(() => {
      settle('timeout', { timeoutMs }, undefined, new Error(`Timed out waiting for ${label}.`))
    }, timeoutMs)

    subscription = subscribe({
      onData(value) {
        observe?.(value, startedAtMs, started)
        if (!isRenderable(value)) return
        settle('ok', summarizeResult(value), value)
      },
      onError(error) {
        settle('error', { message: error.message }, undefined, error)
      },
    })

    if (settled) subscription.unsubscribe()
  })
}

function summarizeSummaryRead(read: DashboardSummaryRead): Measurement['result'] {
  return {
    firstRenderable: 'dashboard.getSummary',
    identity: read.identity,
    workGeneration: read.workGeneration,
    freshness: read.freshness,
    ...summarizeResult(read.data),
  }
}

/** Keep one Summary wake subscription active while its Server-owned typed pull is admitted and verified. */
function firstSummaryRead(
  phase: string,
  timeoutMs: number,
  subscribe: (callbacks: SubscriptionCallbacks<DashboardSummaryInvalidation>) => Unsubscribable,
  pull: () => Promise<DashboardSummaryRead>
): Promise<DashboardSummaryRead> {
  const startedAtMs = elapsedMs()
  const started = performance.now()

  return new Promise<DashboardSummaryRead>((resolvePromise, rejectPromise) => {
    let settled = false
    let pulling = false
    let subscription: Unsubscribable | null = null
    const settle = (
      outcome: Measurement['outcome'],
      result: Measurement['result'],
      read?: DashboardSummaryRead,
      error?: Error
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      subscription?.unsubscribe()
      record(phase, 'dashboard.getSummary.first-renderable', startedAtMs, started, outcome, result)
      if (error) rejectPromise(error)
      else if (read) resolvePromise(read)
      else rejectPromise(new Error('Dashboard Summary pull settled without a read.'))
    }
    const timeout = setTimeout(() => {
      settle(
        'timeout',
        { timeoutMs },
        undefined,
        new Error('Timed out waiting for Dashboard Summary pull.')
      )
    }, timeoutMs)

    subscription = subscribe({
      onData(wake) {
        if (pulling || settled) return
        pulling = true
        record(phase, 'dashboard.subscribeSummary.wake', startedAtMs, started, 'ok', {
          identity: wake.identity,
          workGeneration: wake.workGeneration,
          cause: wake.cause,
        })
        void pull()
          .then((read) => {
            try {
              assertMatchingDashboardSummaryRead(wake, read)
            } catch (error: unknown) {
              const normalized = error instanceof Error ? error : new Error(String(error))
              settle(
                'error',
                {
                  wakeIdentity: wake.identity,
                  wakeGeneration: wake.workGeneration,
                  readIdentity: read.identity,
                  readGeneration: read.workGeneration,
                },
                undefined,
                normalized
              )
              return
            }
            settle('ok', summarizeSummaryRead(read), read)
          })
          .catch((error: unknown) => {
            const normalized = error instanceof Error ? error : new Error(String(error))
            settle('error', { message: normalized.message }, undefined, normalized)
          })
      },
      onError(error) {
        settle('error', { message: error.message }, undefined, error)
      },
    })

    if (settled) subscription.unsubscribe()
  })
}

/** Measure one lifecycle-only Push through the typed Pull that supplies first-renderable evidence. */
function firstCliProjectionRead<T>(
  phase: string,
  label: string,
  timeoutMs: number,
  subscribe: (callbacks: SubscriptionCallbacks<CliProjectionNotice>) => Unsubscribable,
  pull: () => Promise<CliProjectionState<T>>
): Promise<CliProjectionState<T>> {
  const startedAtMs = elapsedMs()
  const started = performance.now()

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false
    let pulling = false
    let pullAgain = false
    let latestWake: CliProjectionNotice | null = null
    let subscription: Unsubscribable | null = null

    const settle = (
      outcome: Measurement['outcome'],
      result: Measurement['result'],
      read?: CliProjectionState<T>,
      error?: Error
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      subscription?.unsubscribe()
      record(phase, `${label}.first-renderable`, startedAtMs, started, outcome, result)
      if (error) rejectPromise(error)
      else if (read) resolvePromise(read)
      else rejectPromise(new Error(`${label} Pull settled without a read.`))
    }

    const runPull = async (): Promise<void> => {
      if (pulling || settled) {
        pullAgain = true
        return
      }
      pulling = true
      try {
        do {
          pullAgain = false
          const wake = latestWake
          const read = await pull()
          if (settled) return
          if (wake && read.identity !== wake.identity) {
            settle(
              'error',
              { wakeIdentity: wake.identity, readIdentity: read.identity },
              undefined,
              new Error(`${label} Push and Pull identities do not match.`)
            )
            return
          }
          if (read.state !== 'loading') {
            settle(
              'ok',
              {
                ...summarizeResult(read.data),
                firstRenderable: label,
                identity: read.identity,
                workGeneration: read.workGeneration,
                freshness: read.freshness,
                state: read.state,
              },
              read
            )
            return
          }
        } while (pullAgain && !settled)
      } catch (error: unknown) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        settle('error', { message: normalized.message }, undefined, normalized)
      } finally {
        pulling = false
      }
    }

    const timeout = setTimeout(() => {
      settle(
        'timeout',
        { timeoutMs },
        undefined,
        new Error(`Timed out waiting for first-renderable ${label} Pull.`)
      )
    }, timeoutMs)

    subscription = subscribe({
      onData(wake) {
        latestWake = wake
        record(phase, `${label}.wake`, startedAtMs, started, 'ok', {
          identity: wake.identity,
          workGeneration: wake.workGeneration,
          state: wake.state,
        })
        void runPull()
      },
      onError(error) {
        settle('error', { message: error.message }, undefined, error)
      },
    })

    if (settled) subscription.unsubscribe()
  })
}

function firstRootContextRead(
  phase: string,
  timeoutMs: number,
  subscribe: (callbacks: SubscriptionCallbacks<CliProjectionNotice>) => Unsubscribable,
  pull: () => Promise<CliProjectionState<RootContextResolvedState>>
): Promise<CliProjectionState<RootContextResolvedState>> {
  return firstCliProjectionRead(phase, 'rootContext.readProjection', timeoutMs, subscribe, pull)
}

function firstPlanningCliProjectionRead(
  phase: string,
  timeoutMs: number,
  selector: PlanningCliProjectionSelector,
  subscribe: (callbacks: SubscriptionCallbacks<CliProjectionNotice>) => Unsubscribable,
  pull: () => Promise<PlanningCliProjectionState>
): Promise<PlanningCliProjectionState> {
  return firstCliProjectionRead(
    phase,
    `planningCliProjection.${selector.kind}.read`,
    timeoutMs,
    subscribe,
    pull
  )
}

function recordProjectionStage(
  phase: string,
  label: string,
  startedAtMs: number,
  started: number,
  value: unknown
): void {
  if (typeof value !== 'object' || value === null || Reflect.get(value, 'type') !== 'stage') return
  const stage = Reflect.get(value, 'phase')
  const workGeneration = Reflect.get(value, 'workGeneration')
  if (typeof stage !== 'string' || typeof workGeneration !== 'number') return
  record(phase, `${label}.${stage}`, startedAtMs, started, 'ok', {
    eventType: 'stage',
    workGeneration,
  })
}

function isProjectionSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (Reflect.get(value, 'type') !== 'snapshot') return false
  const snapshot = Reflect.get(value, 'snapshot')
  if (typeof snapshot !== 'object' || snapshot === null) return false
  const freshness = Reflect.get(snapshot, 'freshness')
  return freshness === 'current' || freshness === 'stale-display-only'
}

function isFirstChangeRenderable(value: unknown): boolean {
  if (isProjectionSnapshot(value)) return true
  if (typeof value !== 'object' || value === null || Reflect.get(value, 'type') !== 'batch') {
    return false
  }
  const batch = Reflect.get(value, 'batch')
  return (
    typeof batch === 'object' &&
    batch !== null &&
    Array.isArray(Reflect.get(batch, 'rows')) &&
    Reflect.get(batch, 'rows').length > 0
  )
}

function waitForSubscriptionClose(): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, 100)
  })
}

function createWsClient(server: RunningServer) {
  let resolveSocketClose: (() => void) | null = null
  const socketClosed = new Promise<void>((resolvePromise) => {
    resolveSocketClose = resolvePromise
  })
  const wsClient = createWSClient({
    url: `ws://localhost:${server.port}/trpc`,
    // ws implements the browser WebSocket shape but its package type is not structurally identical.
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    onClose() {
      resolveSocketClose?.()
      resolveSocketClose = null
    },
  })
  const client = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
  return {
    client,
    close: async () => {
      const wasConnected = wsClient.connection !== null
      await wsClient.close()
      if (wasConnected) await socketClosed
    },
  }
}

async function withRunningServer<T>(
  projectDir: string,
  port: number,
  phase: string,
  task: (server: RunningServer) => Promise<T>
): Promise<T> {
  const startedAtMs = elapsedMs()
  const started = performance.now()
  const server = await startServer({ projectDir, port, enableWatcher: false })
  record(phase, 'server.start', startedAtMs, started, 'ok', { port: server.port })
  try {
    return await task(server)
  } finally {
    await server.close()
  }
}

async function measureDashboard(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'dashboard-cold', async (server) => {
    const firstClient = createWsClient(server)
    try {
      await firstSummaryRead(
        'dashboard-cold',
        timeoutMs,
        (callbacks) =>
          firstClient.client.dashboard.subscribeSummary.subscribe(undefined, callbacks),
        () => firstClient.client.dashboard.getSummary.query()
      )
    } finally {
      await firstClient.close()
    }
    await waitForSubscriptionClose()

    const reloadClient = createWsClient(server)
    try {
      await firstSummaryRead(
        'dashboard-reload',
        timeoutMs,
        (callbacks) =>
          reloadClient.client.dashboard.subscribeSummary.subscribe(undefined, callbacks),
        () => reloadClient.client.dashboard.getSummary.query()
      )
    } finally {
      await reloadClient.close()
    }
  })
}

async function measureDashboardPage(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'dashboard-page-cold', async (server) => {
    const client = createWsClient(server)
    try {
      const summary = firstSummaryRead(
        'dashboard-page-cold',
        timeoutMs,
        (callbacks) => client.client.dashboard.subscribeSummary.subscribe(undefined, callbacks),
        () => client.client.dashboard.getSummary.query()
      )
      const deferredSecondary = summary.then(() =>
        Promise.all([
          firstPayload(
            'dashboard-page-cold',
            'dashboard.subscribeTrends',
            timeoutMs,
            (callbacks) => client.client.dashboard.subscribeTrends.subscribe(undefined, callbacks),
            isProjectionSnapshot
          ),
          firstPayload(
            'dashboard-page-cold',
            'dashboard.subscribeGit',
            timeoutMs,
            (callbacks) => client.client.dashboard.subscribeGit.subscribe(undefined, callbacks),
            isProjectionSnapshot
          ),
          firstPlanningCliProjectionRead(
            'dashboard-page-cold',
            timeoutMs,
            { kind: 'opsx-config-bundle' },
            (callbacks) =>
              client.client.planningCliProjection.subscribe.subscribe(
                { kind: 'opsx-config-bundle' },
                callbacks
              ),
            () => client.client.planningCliProjection.read.query({ kind: 'opsx-config-bundle' })
          ),
          firstPlanningCliProjectionRead(
            'dashboard-page-cold',
            timeoutMs,
            { kind: 'opsx-status-list' },
            (callbacks) =>
              client.client.planningCliProjection.subscribe.subscribe(
                { kind: 'opsx-status-list' },
                callbacks
              ),
            () => client.client.planningCliProjection.read.query({ kind: 'opsx-status-list' })
          ),
        ])
      )
      await Promise.all([summary, deferredSecondary])
    } finally {
      await client.close()
    }
  })
}

async function measureTransport(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'transport-cold', async (server) => {
    const client = createWsClient(server)
    try {
      await firstRootContextRead(
        'transport-cold',
        timeoutMs,
        (callbacks) =>
          client.client.rootContext.subscribeProjection.subscribe(undefined, callbacks),
        () => client.client.rootContext.readProjection.query()
      )
    } finally {
      await client.close()
    }
  })
}

async function measureChanges(projectDir: string, port: number, timeoutMs: number): Promise<void> {
  await withRunningServer(projectDir, port, 'changes-cold', async (server) => {
    const firstClient = createWsClient(server)
    try {
      await firstPayload(
        'changes-cold',
        'change.subscribeBatches.first-row',
        timeoutMs,
        (callbacks) => firstClient.client.change.subscribeBatches.subscribe(undefined, callbacks),
        isFirstChangeRenderable,
        (value, startedAtMs, started) =>
          recordProjectionStage(
            'changes-cold',
            'change.subscribeBatches',
            startedAtMs,
            started,
            value
          )
      )
    } finally {
      await firstClient.close()
    }
    await waitForSubscriptionClose()

    const reloadClient = createWsClient(server)
    try {
      await firstPayload(
        'changes-reload',
        'change.subscribeBatches.first-row',
        timeoutMs,
        (callbacks) => reloadClient.client.change.subscribeBatches.subscribe(undefined, callbacks),
        isFirstChangeRenderable,
        (value, startedAtMs, started) =>
          recordProjectionStage(
            'changes-reload',
            'change.subscribeBatches',
            startedAtMs,
            started,
            value
          )
      )
    } finally {
      await reloadClient.close()
    }
  })
}

async function measureChangesPage(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'changes-page-cold', async (server) => {
    const client = createWsClient(server)
    try {
      const firstRow = firstPayload(
        'changes-page-cold',
        'change.subscribeBatches.first-row',
        timeoutMs,
        (callbacks) => client.client.change.subscribeBatches.subscribe(undefined, callbacks),
        isFirstChangeRenderable
      )
      await Promise.all([
        firstRow,
        firstRow.then(() =>
          firstPlanningCliProjectionRead(
            'changes-page-cold',
            timeoutMs,
            { kind: 'opsx-status-list' },
            (callbacks) =>
              client.client.planningCliProjection.subscribe.subscribe(
                { kind: 'opsx-status-list' },
                callbacks
              ),
            () => client.client.planningCliProjection.read.query({ kind: 'opsx-status-list' })
          )
        ),
      ])
    } finally {
      await client.close()
    }
  })
}

async function measureConfigBundle(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'config-cold', async (server) => {
    const client = createWsClient(server)
    try {
      await firstPlanningCliProjectionRead(
        'config-cold',
        timeoutMs,
        { kind: 'opsx-config-bundle' },
        (callbacks) =>
          client.client.planningCliProjection.subscribe.subscribe(
            { kind: 'opsx-config-bundle' },
            callbacks
          ),
        () => client.client.planningCliProjection.read.query({ kind: 'opsx-config-bundle' })
      )
    } finally {
      await client.close()
    }
  })
}

async function measureStatusList(
  projectDir: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  await withRunningServer(projectDir, port, 'status-cold', async (server) => {
    const client = createWsClient(server)
    try {
      await firstPlanningCliProjectionRead(
        'status-cold',
        timeoutMs,
        { kind: 'opsx-status-list' },
        (callbacks) =>
          client.client.planningCliProjection.subscribe.subscribe(
            { kind: 'opsx-status-list' },
            callbacks
          ),
        () => client.client.planningCliProjection.read.query({ kind: 'opsx-status-list' })
      )
    } finally {
      await client.close()
    }
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
  .option('port', {
    describe: 'Isolated preferred Server port; avoids attaching to an interactive development page',
    type: 'number',
    default: 34_800,
  })
  .option('timeout', {
    describe: 'Maximum first-payload wait per subscription in milliseconds',
    type: 'number',
    default: 30_000,
  })
  .option('scenario', {
    describe: 'One isolated measurement group, or all groups in sequence',
    choices: [
      'all',
      'transport',
      'dashboard',
      'dashboard-page',
      'config',
      'status',
      'changes',
      'changes-page',
    ] as const,
    default: 'all',
  })
  .strict()
  .parse()) as BenchArgs
const projectDir = resolve(process.cwd(), argv.dir)

let fatalError: Error | null = null
try {
  if (argv.scenario === 'all' || argv.scenario === 'transport') {
    await measureTransport(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'dashboard') {
    await measureDashboard(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'dashboard-page') {
    await measureDashboardPage(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'config') {
    await measureConfigBundle(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'status') {
    await measureStatusList(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'changes') {
    await measureChanges(projectDir, argv.port, argv.timeout)
  }
  if (argv.scenario === 'all' || argv.scenario === 'changes-page') {
    await measureChangesPage(projectDir, argv.port, argv.timeout)
  }
} catch (error) {
  fatalError = error instanceof Error ? error : new Error(String(error))
}

const output = `${JSON.stringify(
  {
    benchmark: 'live-projection-loading',
    projectDir,
    generatedAt: new Date().toISOString(),
    fatalError: fatalError?.message ?? null,
    measurements,
  },
  null,
  2
)}\n`

writeSync(process.stdout.fd, output)

if (fatalError) process.exitCode = 1
