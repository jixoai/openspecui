/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Pin trigger 1: the first lease on a pool root (0 -> 1) settles the registered reads that root
 *    covers, after `record.ready` and without lengthening the lease.
 * 2. Pin trigger 2: `ReactiveObservationEnvironment.acquireRoot` settles on its memoized branch —
 *    the real "first attach after boot", which the pool never sees because the environment
 *    reference-counts repeated logical acquisition.
 * 3. Pin trigger 3: a *completed* rebuild settles every logical root bound to that physical watcher.
 * 4. Keep the simulation honest: only the library's `subscribe` transport is stubbed, so leases,
 *    roots, pool bookkeeping, and every read stay real and an event can never make a trigger test
 *    pass for the wrong reason.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S1 (CP2): arm and attach settlement.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The platform silently delivering nothing is the defect's shape. Stub only the subscription
// transport: every other library surface stays real. The handle must keep the library's shape — a
// callable with `unsubscribe()` — or teardown fails on our own consumer rather than on anything
// under test.
vi.mock('@parcel/watcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@parcel/watcher')>()
  return {
    ...actual,
    subscribe: vi.fn(async () =>
      Object.assign(() => undefined, { unsubscribe: async () => undefined })
    ),
  }
})

import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import { ReactiveObservationEnvironment } from './observation-environment.js'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import { getProjectWatcher, type ProjectWatcher } from './project-watcher.js'
import { clearCache, reactiveReadFile } from './reactive-fs.js'
import {
  setSettlementPassHookForTests,
  type SettlementPassHookEvent,
} from './settlement-coordinator.js'
import { acquireWatcherRoot, closeAllWatchers } from './watcher-pool.js'

const tempDirs: string[] = []

async function createRoot(): Promise<string> {
  const root = await createTempDir()
  tempDirs.push(root)
  return root
}

/**
 * Record read-phase entries and let a test await the next one. The wait is resolved by the gate
 * itself; the bounded guard exists only so a missing trigger fails as itself, not as a timeout.
 */
function recordSettlementPasses(): {
  events: SettlementPassHookEvent[]
  waitForPassCount(count: number, timeoutMs?: number): Promise<void>
  waitForCommitted(count: number, timeoutMs?: number): Promise<void>
} {
  const events: SettlementPassHookEvent[] = []
  const waiters: Array<() => void> = []
  setSettlementPassHookForTests((event) => {
    events.push(event)
    for (const resolve of waiters.splice(0)) resolve()
  })

  async function waitForPassCount(count: number, timeoutMs = 2_000): Promise<void> {
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
    async waitForCommitted(count, timeoutMs = 2_000) {
      await waitForPassCount(count, timeoutMs)
      await Promise.all(events.slice(0, count).map((event) => event.completed))
    },
  }
}

function reinitializeWatcher(watcher: ProjectWatcher, reason: string): Promise<void> {
  return (watcher as unknown as { reinitialize(reason: string): Promise<void> }).reinitialize(
    reason
  )
}

afterEach(async () => {
  setSettlementPassHookForTests(null)
  clearCache()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => cleanupTempDir(dir)))
})

describe('settlement triggers', () => {
  it('settles a newly armed root when its pool record goes 0 -> 1', async () => {
    const root = await createRoot()
    const file = join(root, 'value.txt')
    await writeFile(file, 'before', 'utf8')
    await expect(reactiveReadFile(file)).resolves.toBe('before')

    const recorder = recordSettlementPasses()
    // Disk truth moves with no event: the transport stubbed above never delivers one.
    await writeFile(file, 'after', 'utf8')

    const release = await acquireWatcherRoot(root)
    try {
      await recorder.waitForCommitted(1)
      expect(recorder.events[0]?.rootPath).toBe(resolveRealPathThroughExistingAncestor(root))
      await expect(reactiveReadFile(file)).resolves.toBe('after')
    } finally {
      await release()
    }
  })

  it('settles a root the environment already holds on its memoized attach branch', async () => {
    const root = await createRoot()
    const file = join(root, 'value.txt')
    await writeFile(file, 'first', 'utf8')
    await expect(reactiveReadFile(file)).resolves.toBe('first')

    const environment = new ReactiveObservationEnvironment()
    const recorder = recordSettlementPasses()

    try {
      await environment.acquireRoot(root)
      await recorder.waitForCommitted(1)

      // No event can carry this write, and the second acquisition only bumps the reference count.
      await writeFile(file, 'second', 'utf8')
      await environment.acquireRoot(root)

      await recorder.waitForCommitted(2)
      expect(recorder.events[1]?.rootPath).toBe(resolveRealPathThroughExistingAncestor(root))
      await expect(reactiveReadFile(file)).resolves.toBe('second')
    } finally {
      await environment.dispose()
    }
  })

  it('settles every logical root of a physical watcher after a completed rebuild', async () => {
    const root = await createRoot()
    const nestedRoot = join(root, 'nested')
    const primaryFile = join(root, 'primary.txt')
    const nestedFile = join(nestedRoot, 'nested.txt')
    await writeFile(primaryFile, 'before', 'utf8')
    await expect(reactiveReadFile(primaryFile)).resolves.toBe('before')
    await expect(reactiveReadFile(nestedFile)).resolves.toBeNull()

    const recorder = recordSettlementPasses()
    const releasePrimary = await acquireWatcherRoot(root)
    const releaseNested = await acquireWatcherRoot(nestedRoot)

    try {
      // Two 0 -> 1 arms settle both logical roots, which share one physical watcher (the nested
      // root is missing, so its nearest existing ancestor is the primary root). That sharing is
      // exactly what the rebuild below proves: one reinitialized watcher settles both roots.
      await recorder.waitForCommitted(2)

      await mkdir(nestedRoot, { recursive: true })
      await writeFile(primaryFile, 'after', 'utf8')
      await writeFile(nestedFile, 'created', 'utf8')

      await reinitializeWatcher(getProjectWatcher(root), 'manual')

      await recorder.waitForCommitted(4)
      await expect(reactiveReadFile(primaryFile)).resolves.toBe('after')
      await expect(reactiveReadFile(nestedFile)).resolves.toBe('created')
    } finally {
      await releaseNested()
      await releasePrimary()
    }
  })
})
