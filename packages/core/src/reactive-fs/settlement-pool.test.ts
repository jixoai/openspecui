/**
 * Orthogonal intents (created 2026-11-05 Asia/Shanghai):
 * 1. Pin the pooled interval's ownership: one process-level timer, started by the first lease and
 *    stopped by the last, absent while no lease exists, and stopped by `closeAllWatchers()`, which
 *    bypasses release.
 * 2. Pin the delay multiset: N distinct physical watchers contribute their per-watcher liveness
 *    intervals plus exactly one pooled settlement interval at the cadence — so jitter can never
 *    leak into `setInterval`'s own delay (it lands in the per-tick `setTimeout`).
 * 3. Pin skip-when-idle: a pass over a leased root with no registered reads performs zero
 *    readdir/readFile/stat, and a root that already owes a pass is skipped instead of deriving a
 *    redundant trailing one.
 * 4. Pin the cadence seam: `OPENSPECUI_SETTLEMENT_INTERVAL_MS` is read when the interval starts
 *    (never at module load), and a later env change cannot retune a live timer.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S3 (CP3): the pooled periodic settlement net.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls.
vi.mock('node:fs/promises', { spy: true })

import { cleanupTempDir, createTempDir, waitForDebounce } from '../__tests__/test-utils.js'
import { clearCache, reactiveReadDir } from './reactive-fs.js'
import {
  getSettlementDiagnostics,
  setSettlementPassHookForTests,
  type SettlementPassHookEvent,
} from './settlement-coordinator.js'
import { acquireWatcherRoot, closeAllWatchers } from './watcher-pool.js'

const SETTLEMENT_INTERVAL_ENV = 'OPENSPECUI_SETTLEMENT_INTERVAL_MS'

/** ProjectWatcher's per-physical-watcher path-liveness interval; one per distinct physical watcher. */
const PATH_LIVENESS_INTERVAL_MS = 3000

function createSetIntervalSpy() {
  return vi.spyOn(globalThis, 'setInterval')
}

type SetIntervalSpy = ReturnType<typeof createSetIntervalSpy>

function intervalDelays(spy: SetIntervalSpy): number[] {
  return spy.mock.calls.map((call) => Number(call[1])).sort((left, right) => left - right)
}

interface SettlementPassRecorder {
  events: SettlementPassHookEvent[]
  waitForPassCount(count: number, timeoutMs?: number): Promise<void>
  waitForCommitted(count: number, timeoutMs?: number): Promise<void>
}

/** Record read-phase entries and let a test await them; waits are driven by the gate, not by sleep. */
function recordSettlementPasses(
  onPass?: (event: SettlementPassHookEvent) => void | Promise<void>
): SettlementPassRecorder {
  const events: SettlementPassHookEvent[] = []
  const waiters: Array<() => void> = []
  setSettlementPassHookForTests(async (event) => {
    events.push(event)
    for (const resolve of waiters.splice(0)) resolve()
    if (onPass) await onPass(event)
  })

  async function waitForPassCount(count: number, timeoutMs = 5_000): Promise<void> {
    while (events.length < count) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`settlement pass ${count} never began (only ${events.length})`)),
          timeoutMs
        )
        waiters.push(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }

  return {
    events,
    waitForPassCount,
    async waitForCommitted(count, timeoutMs = 5_000) {
      await waitForPassCount(count, timeoutMs)
      await Promise.all(events.slice(0, count).map((event) => event.completed))
    },
  }
}

function createGate(): { promise: Promise<void>; release: () => void } {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('pooled settlement interval', () => {
  const tempDirs: string[] = []
  let intervalSpy: SetIntervalSpy | null = null

  async function createRootDir(): Promise<string> {
    const dir = await createTempDir()
    tempDirs.push(dir)
    return dir
  }

  afterEach(async () => {
    setSettlementPassHookForTests(null)
    intervalSpy?.mockRestore()
    intervalSpy = null
    delete process.env[SETTLEMENT_INTERVAL_ENV]
    clearCache()
    await closeAllWatchers()
    await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
  })

  it('runs one settlement interval for N distinct physical watchers, at the exact cadence', async () => {
    process.env[SETTLEMENT_INTERVAL_ENV] = '7777'
    const spy = createSetIntervalSpy()
    intervalSpy = spy

    await acquireWatcherRoot(await createRootDir())
    expect(getSettlementDiagnostics().activeTimers).toBe(1)

    await acquireWatcherRoot(await createRootDir())
    expect(getSettlementDiagnostics().activeTimers).toBe(1)

    // Two distinct physical watchers: each owns one 3000 ms path-liveness interval, and the pooled
    // settlement interval is the single remaining delay — exactly the cadence. Jitter is scheduled
    // per tick (`setTimeout`), so any jitter here would break this multiset.
    expect(intervalDelays(spy)).toEqual([
      PATH_LIVENESS_INTERVAL_MS,
      PATH_LIVENESS_INTERVAL_MS,
      Number(process.env[SETTLEMENT_INTERVAL_ENV]),
    ])
  })

  it('starts with the first lease, stops with the last, and is stopped by full teardown', async () => {
    const firstRoot = await createRootDir()
    const secondRoot = await createRootDir()

    expect(getSettlementDiagnostics().activeTimers).toBe(0)

    const releaseFirst = await acquireWatcherRoot(firstRoot)
    expect(getSettlementDiagnostics().activeTimers).toBe(1)

    const releaseSecond = await acquireWatcherRoot(secondRoot)
    expect(getSettlementDiagnostics().activeTimers).toBe(1)

    await releaseSecond()
    expect(getSettlementDiagnostics().activeTimers).toBe(1)
    await releaseFirst()
    expect(getSettlementDiagnostics().activeTimers).toBe(0)

    await acquireWatcherRoot(firstRoot)
    expect(getSettlementDiagnostics().activeTimers).toBe(1)
    // Full teardown clears the registry instead of releasing leases, so it must stop the interval
    // itself — a release-only implementation would leave it running here.
    await closeAllWatchers()
    expect(getSettlementDiagnostics().activeTimers).toBe(0)
  })

  it('performs zero readdir/readFile/stat for a pooled pass over a root with no registered reads', async () => {
    process.env[SETTLEMENT_INTERVAL_ENV] = '200'
    const root = await createRootDir()
    const recorder = recordSettlementPasses()

    // Pass 1 is the arm settle (S1); pass 2 is the pooled tick this test owns.
    await acquireWatcherRoot(root)
    await recorder.waitForCommitted(1)

    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    const readdirSpy = vi.mocked(fsPromises.readdir)
    const statSpy = vi.mocked(fsPromises.stat)
    readFileSpy.mockClear()
    readdirSpy.mockClear()
    statSpy.mockClear()

    await recorder.waitForCommitted(2)

    expect(readFileSpy).not.toHaveBeenCalled()
    expect(readdirSpy).not.toHaveBeenCalled()
    expect(statSpy).not.toHaveBeenCalled()

    // Positive control: the module spies observe the very registration reads a non-empty pass would
    // reuse, so the zero counts above are evidence rather than missing interception.
    await expect(reactiveReadDir(root)).resolves.toEqual([])
    expect(readdirSpy).toHaveBeenCalled()
  })

  it('reads the cadence when the interval starts and never retunes a live timer', async () => {
    const spy = createSetIntervalSpy()
    intervalSpy = spy
    const settlementDelays = (): number[] =>
      intervalDelays(spy).filter((delay) => delay !== PATH_LIVENESS_INTERVAL_MS)

    process.env[SETTLEMENT_INTERVAL_ENV] = '1111'
    const releaseFirst = await acquireWatcherRoot(await createRootDir())
    expect(settlementDelays()).toEqual([1111])

    // Changing the env while a lease lives must neither create nor retune a timer.
    process.env[SETTLEMENT_INTERVAL_ENV] = '2222'
    const releaseSecond = await acquireWatcherRoot(await createRootDir())
    expect(settlementDelays()).toEqual([1111])

    await releaseSecond()
    await releaseFirst()
    expect(getSettlementDiagnostics().activeTimers).toBe(0)

    // The stopped interval is gone, so the next lease reads the seam again.
    process.env[SETTLEMENT_INTERVAL_ENV] = '3333'
    await acquireWatcherRoot(await createRootDir())
    expect(settlementDelays()).toEqual([1111, 3333])
  })

  it('skips a root that already owes a pass instead of deriving a trailing one', async () => {
    process.env[SETTLEMENT_INTERVAL_ENV] = '120'
    const gate = createGate()
    // Hold the arm settle inside its read phase so the root owes a pass across several ticks.
    const recorder = recordSettlementPasses(async () => {
      await gate.promise
    })
    await acquireWatcherRoot(await createRootDir())
    await recorder.waitForPassCount(1)

    // Five-plus pooled ticks elapse while the root is in flight.
    await waitForDebounce(700)
    expect(recorder.events.length).toBe(1)

    gate.release()
    await recorder.waitForCommitted(1)
    // No trailing pass was derived by any of those ticks.
    expect(recorder.events.length).toBe(1)
  })
})
