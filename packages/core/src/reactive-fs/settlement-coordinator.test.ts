/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Pin the coordinator's join semantics: requests issued before a pass begins reading share that
 *    pass instead of each paying for their own re-read.
 * 2. Pin the trailing obligation: a request that arrives after a pass's read phase began is served
 *    by a trailing pass, and its promise resolves only after that pass committed (join-and-discard
 *    must fail here).
 * 3. Pin the second trailing half with two ordered gates: a request arriving during the *trailing*
 *    pass's read phase derives one more pass, so neither "clear dirty and stop" nor an unbounded
 *    `while (dirty)` chain can pass. Read-phase entries are asserted exactly (2 and 3).
 * 4. Pin zero filesystem reads for a root that covers no registration.
 * 5. Construct every interleaving through the exported read-phase gate — no sleep and no real
 *    timing is used to make a request land inside a read phase.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S1 (S5.6): single-flight trailing, both halves.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls.
vi.mock('node:fs/promises', { spy: true })

import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import { resolveRealPathThroughExistingAncestor } from './path-realpath.js'
import { clearCache, reactiveReadFile } from './reactive-fs.js'
import {
  getSettlementDiagnostics,
  requestSettlement,
  setSettlementPassHookForTests,
  type SettlementPassHookEvent,
} from './settlement-coordinator.js'

function createGate(): { promise: Promise<void>; release: () => void } {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/**
 * Record every read-phase entry and optionally gate individual passes. `waitForPassCount` is
 * resolved by the gate itself, so a test never guesses how long a pass takes; the bounded guard
 * exists only so a mutation that removes a pass fails as itself instead of as a test timeout.
 */
function recordSettlementPasses(
  onPass?: (event: SettlementPassHookEvent) => void | Promise<void>
): {
  events: SettlementPassHookEvent[]
  waitForPassCount(count: number, timeoutMs?: number): Promise<void>
} {
  const events: SettlementPassHookEvent[] = []
  const waiters: Array<() => void> = []
  setSettlementPassHookForTests(async (event) => {
    events.push(event)
    for (const resolve of waiters.splice(0)) resolve()
    if (onPass) await onPass(event)
  })

  return {
    events,
    async waitForPassCount(count: number, timeoutMs = 2_000): Promise<void> {
      while (events.length < count) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error(`settlement pass ${count} never began (only ${events.length} began)`)
              ),
            timeoutMs
          )
          waiters.push(() => {
            clearTimeout(timer)
            resolve()
          })
        })
      }
    },
  }
}

describe('settlement coordinator', () => {
  let tempDir: string
  let targetFile: string
  let normalizedRoot: string

  beforeEach(async () => {
    tempDir = await createTempDir()
    normalizedRoot = resolveRealPathThroughExistingAncestor(tempDir)
    targetFile = join(tempDir, 'value.txt')
    await writeFile(targetFile, 'before', 'utf8')
    await expect(reactiveReadFile(targetFile)).resolves.toBe('before')
  })

  afterEach(async () => {
    setSettlementPassHookForTests(null)
    clearCache()
    await cleanupTempDir(tempDir)
  })

  it('joins concurrent requests issued before the read phase into one pass', async () => {
    const { events } = recordSettlementPasses()
    await writeFile(targetFile, 'after', 'utf8')

    // Both requests are issued in one synchronous turn, so neither can have observed a read phase.
    await Promise.all([requestSettlement(normalizedRoot), requestSettlement(normalizedRoot)])

    expect(events.map((event) => event.passIndex)).toEqual([1])
    // The joined pass committed before either request resolved.
    await expect(reactiveReadFile(targetFile)).resolves.toBe('after')
  })

  it('serves a request arriving during the read phase from a trailing pass', async () => {
    const firstGate = createGate()
    const order: string[] = []
    const recorder = recordSettlementPasses(async (event) => {
      order.push(`pass-${event.passIndex}`)
      if (event.passIndex === 1) await firstGate.promise
    })

    const firstRequest = requestSettlement(normalizedRoot)
    await recorder.waitForPassCount(1)

    await writeFile(targetFile, 'after', 'utf8')
    // Arrives while pass 1 is inside its read phase (its gate is still held).
    const trailingRequest = requestSettlement(normalizedRoot)
    void trailingRequest.then(() => order.push('trailing-resolved'))
    firstGate.release()

    await trailingRequest
    await firstRequest

    expect(order).toEqual(['pass-1', 'pass-2', 'trailing-resolved'])
    // Exactly two read-phase entries: one joined pass plus one derived pass, and no chain.
    expect(recorder.events.map((event) => event.passIndex)).toEqual([1, 2])
    await expect(reactiveReadFile(targetFile)).resolves.toBe('after')
  })

  it('derives one more pass for a request arriving during the trailing pass read phase', async () => {
    const firstGate = createGate()
    const secondGate = createGate()
    const recorder = recordSettlementPasses(async (event) => {
      if (event.passIndex === 1) await firstGate.promise
      if (event.passIndex === 2) await secondGate.promise
    })

    const firstRequest = requestSettlement(normalizedRoot)
    await recorder.waitForPassCount(1)
    await writeFile(targetFile, 'second', 'utf8')
    const trailingRequest = requestSettlement(normalizedRoot)
    firstGate.release()

    // Two ordered gates: the third request must land inside the *trailing* pass's read phase.
    await recorder.waitForPassCount(2)
    await writeFile(targetFile, 'third', 'utf8')
    const secondTrailingRequest = requestSettlement(normalizedRoot)
    secondGate.release()

    await Promise.all([firstRequest, trailingRequest, secondTrailingRequest])

    expect(recorder.events.map((event) => event.passIndex)).toEqual([1, 2, 3])
    await expect(reactiveReadFile(targetFile)).resolves.toBe('third')
  })

  it('owns no timer and retains no per-root state once a burst went idle', async () => {
    const { events } = recordSettlementPasses()
    const pending = requestSettlement(normalizedRoot)
    expect(getSettlementDiagnostics()).toEqual({ activeTimers: 0, busyRootCount: 1 })

    await pending
    expect(events.map((event) => event.passIndex)).toEqual([1])
    // No pooled interval in this slice, and the root's state is gone rather than parked.
    expect(getSettlementDiagnostics()).toEqual({ activeTimers: 0, busyRootCount: 0 })
  })

  it('performs zero filesystem reads for a root that covers no registration', async () => {
    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    const readdirSpy = vi.mocked(fsPromises.readdir)
    const statSpy = vi.mocked(fsPromises.stat)
    readFileSpy.mockClear()
    readdirSpy.mockClear()
    statSpy.mockClear()

    const { events } = recordSettlementPasses()
    await expect(
      requestSettlement(resolveRealPathThroughExistingAncestor(join(tempDir, 'nothing-registered')))
    ).resolves.toBeUndefined()

    expect(events.map((event) => event.passIndex)).toEqual([1])
    expect(readFileSpy).not.toHaveBeenCalled()
    expect(readdirSpy).not.toHaveBeenCalled()
    expect(statSpy).not.toHaveBeenCalled()

    // Positive control: the module spies observe the very registration reads a non-empty pass would
    // reuse, so the zero counts above are evidence rather than missing interception.
    const probeDir = join(tempDir, 'probe-read-owners')
    await mkdir(probeDir)
    const probeFile = join(probeDir, 'entry.txt')
    await writeFile(probeFile, 'content', 'utf8')
    await expect(reactiveReadFile(probeFile)).resolves.toBe('content')
    expect(readFileSpy).toHaveBeenCalled()
  })
})
