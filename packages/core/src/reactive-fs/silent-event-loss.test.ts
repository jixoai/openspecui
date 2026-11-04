/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Record the silent-loss defect as executable evidence: a healthy-looking observation root that
 *    never delivers events must still converge, because losing an event is a normal platform
 *    outcome, not an error the consumer can observe.
 * 2. Simulate the loss honestly — only the library's `subscribe` is stubbed, so leases, roots, pool
 *    bookkeeping and every read stay real; nothing is "closed" that production would keep open.
 * 3. Fail today for the intended reason: no mechanism re-reads a directory whose events stopped.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement CP3, the stall this change exists to remove.
 */
import { afterAll, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir, createTempFile } from '../__tests__/test-utils.js'

// The platform silently delivering nothing is the defect's shape. Stub only the subscription
// transport: every other library surface (snapshot/query/realpath helpers) stays real. The handle
// must keep the library's shape — a callable with `unsubscribe()` — or teardown fails on our own
// consumer rather than on anything under test.
vi.mock('@parcel/watcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@parcel/watcher')>()
  return {
    ...actual,
    subscribe: vi.fn(async () =>
      Object.assign(() => undefined, { unsubscribe: async () => undefined })
    ),
  }
})

import { ReactiveContext } from './reactive-context.js'
import { clearCache, reactiveReadDir } from './reactive-fs.js'
import { acquireWatcherRoot, closeAllWatchers } from './watcher-pool.js'

const SETTLEMENT_INTERVAL_ENV = 'OPENSPECUI_SETTLEMENT_INTERVAL_MS'

describe('silent event loss', () => {
  afterAll(async () => {
    delete process.env[SETTLEMENT_INTERVAL_ENV]
    clearCache()
    await closeAllWatchers()
  })

  it('converges a directory listing whose events never arrive', async () => {
    // The cadence seam is required by the plan (CP3): tests must not wait on the production period.
    process.env[SETTLEMENT_INTERVAL_ENV] = '250'

    const dir = await createTempDir()
    try {
      await createTempFile(dir, 'initial.txt', 'content')
      await acquireWatcherRoot(dir)

      const context = new ReactiveContext()
      const generator = context.stream(async () => reactiveReadDir(dir))
      const first = await generator.next()
      expect(first.value).toContain('initial.txt')

      // Nothing else in the subtree changes after this write, so a lost event is indistinguishable
      // from a quiet directory — which is exactly why the file system owns settlement.
      await createTempFile(dir, 'appeared.txt', 'content')

      const second = await Promise.race([
        generator.next(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('the directory listing was never re-read')), 3_000)
        }),
      ])
      expect(second.value).toContain('initial.txt')
      expect(second.value).toContain('appeared.txt')

      await generator.return(undefined)
    } finally {
      clearCache(dir)
      await cleanupTempDir(dir)
    }
  }, 15_000)
})
