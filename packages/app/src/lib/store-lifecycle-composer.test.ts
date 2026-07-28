/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove the current, terminal, and once gates at the production lifecycle composer.
 * 2. Prove settlement refreshes Store plus only exact-locator Context tabs.
 * 3. Prove reconnect can settle a previously observed active request without replaying history.
 * 4. Prove admitted evidence stays visible until the first current ledger snapshot.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import { describe, expect, it, vi } from 'vitest'
import type { MutationLocatorProjection } from './mutation-observation'
import type { HostedShellTab } from './shell-state'
import { createStoreLifecycleComposer } from './store-lifecycle-composer'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'
const TABS: HostedShellTab[] = [
  { id: 'a-1', sessionId: 'a-1', apiBaseUrl: API_A, createdAt: 1 },
  { id: 'a-2', sessionId: 'a-2', apiBaseUrl: `${API_A}/`, createdAt: 2 },
  { id: 'b', sessionId: 'b', apiBaseUrl: API_B, createdAt: 3 },
]

function record(requestId: string, status: StoreMutationEnvelope['status']): StoreMutationEnvelope {
  const base = {
    requestId,
    envUri: 'env:a',
    kind: 'register' as const,
    observedAt: 1,
  }
  return status === 'accepted' || status === 'running'
    ? { ...base, status }
    : { ...base, status, result: { exitStatus: status === 'succeeded' ? 0 : 1 } }
}

function projection(
  current: boolean,
  records: readonly StoreMutationEnvelope[],
  lifecycle: MutationLocatorProjection['lifecycle'] = current ? 'current' : 'reconnecting'
): MutationLocatorProjection {
  return {
    apiBaseUrl: API_A,
    ownerEpoch: 1,
    lifecycle,
    current,
    cursor: 1,
    records,
    error: lifecycle === 'error' ? 'socket lost' : null,
    observedAt: 1,
  }
}

describe('Store lifecycle composer', () => {
  it('baselines history, ignores active and disconnect evidence, then pulls once per new terminal', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)

    const initial = composer.observe(
      projection(true, [record('historical', 'succeeded'), record('active', 'accepted')]),
      TABS
    )
    expect(initial.active.map(({ requestId }) => requestId)).toEqual(['active'])
    expect(initial.recent.map(({ requestId }) => requestId)).toEqual(['historical'])
    composer.observe(
      projection(true, [record('historical', 'succeeded'), record('active', 'running')]),
      TABS
    )
    const disconnected = composer.observe(
      projection(
        false,
        [record('historical', 'succeeded'), record('active', 'succeeded')],
        'error'
      ),
      TABS
    )
    expect(disconnected.locator).toMatchObject({ lifecycle: 'error', current: false })
    expect(disconnected.recent.map(({ requestId }) => requestId)).toEqual(['historical', 'active'])
    expect(refreshStore).not.toHaveBeenCalled()
    expect(refreshContexts).not.toHaveBeenCalled()

    composer.observe(
      projection(true, [record('historical', 'succeeded'), record('active', 'succeeded')]),
      TABS
    )
    composer.observe(
      projection(true, [record('historical', 'succeeded'), record('active', 'succeeded')]),
      TABS
    )
    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledWith(['a-1', 'a-2'])
  })

  it('settles a new terminal first observed after baseline exactly once', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.observe(projection(true, []), TABS)
    composer.observe(projection(true, [record('late', 'failed')]), TABS)
    composer.observe(projection(true, [record('late', 'failed')]), TABS)
    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledTimes(1)
  })

  it('coalesces multiple terminal edges from one replacement snapshot into one pull', async () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn(async () => {
      throw new Error('Context refresh evidence remains owner-local.')
    })
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.observe(projection(true, [record('one', 'running'), record('two', 'accepted')]), TABS)
    composer.observe(
      projection(true, [record('one', 'succeeded'), record('two', 'indeterminate')]),
      TABS
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledTimes(1)
  })

  it('settles a registered admission already terminal in the first current snapshot', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })

    composer.setLocator(API_A)
    composer.observe(null, TABS)
    composer.registerAdmission(`${API_A}/`, record('current-session', 'accepted'))
    composer.observe(
      projection(true, [record('historical', 'succeeded'), record('current-session', 'succeeded')]),
      TABS
    )

    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledWith(['a-1', 'a-2'])
  })

  it('settles a late admission already present in the first current snapshot', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })

    composer.setLocator(API_A)
    composer.observe(
      projection(true, [record('historical', 'succeeded'), record('late-admission', 'succeeded')]),
      TABS
    )
    composer.registerAdmission(API_A, record('late-admission', 'accepted'))
    composer.registerAdmission(API_A, record('late-admission', 'accepted'))

    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledWith(['a-1', 'a-2'])
  })

  it('waits for reconnect current before settling a late admission from retained terminal evidence', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.observe(projection(true, [record('late-disconnected', 'succeeded')]), TABS)
    composer.observe(
      projection(false, [record('late-disconnected', 'succeeded')], 'reconnecting'),
      TABS
    )
    composer.registerAdmission(API_A, record('late-disconnected', 'accepted'))
    expect(refreshStore).not.toHaveBeenCalled()

    composer.observe(projection(true, [record('late-disconnected', 'succeeded')]), TABS)
    expect(refreshStore).toHaveBeenCalledTimes(1)
    expect(refreshContexts).toHaveBeenCalledWith(['a-1', 'a-2'])
  })

  it('retires pending admission correlation when the Store surface unmounts', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.registerAdmission(API_A, record('retired', 'accepted'))
    composer.setLocator(null)
    composer.registerAdmission(API_A, record('retired', 'accepted'))
    composer.observe(projection(true, [record('retired', 'succeeded')]), TABS)

    expect(refreshStore).not.toHaveBeenCalled()
    expect(refreshContexts).not.toHaveBeenCalled()
  })

  it('retires A admission correlation when the Store surface changes to B', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.registerAdmission(API_A, record('shared-id', 'accepted'))
    composer.setLocator(API_B)
    composer.observe(
      { ...projection(true, [record('shared-id', 'succeeded')]), apiBaseUrl: API_B },
      TABS
    )

    expect(refreshStore).not.toHaveBeenCalled()
    expect(refreshContexts).not.toHaveBeenCalled()
  })

  it('does not correlate a rejected request or another locator with terminal history', () => {
    const refreshStore = vi.fn()
    const refreshContexts = vi.fn()
    const composer = createStoreLifecycleComposer({ refreshStore, refreshContexts })
    composer.setLocator(API_A)
    composer.registerAdmission(API_B, record('other-locator', 'accepted'))
    composer.observe(
      projection(true, [
        record('rejected-before-admission', 'indeterminate'),
        record('other-locator', 'succeeded'),
      ]),
      TABS
    )

    expect(refreshStore).not.toHaveBeenCalled()
    expect(refreshContexts).not.toHaveBeenCalled()
  })

  it('projects a resolved admission until the current ledger carries the request', () => {
    const composer = createStoreLifecycleComposer({
      refreshStore: vi.fn(),
      refreshContexts: vi.fn(),
    })
    composer.setLocator(API_A)
    composer.observe(projection(true, []), TABS)

    composer.registerAdmission(API_A, record('admitted', 'accepted'))
    expect(composer.project(projection(true, [])).active).toEqual([record('admitted', 'accepted')])

    const ledger = projection(true, [record('admitted', 'running')])
    expect(composer.observe(ledger, TABS).active).toEqual([record('admitted', 'running')])
    expect(composer.project(ledger).active).toEqual([record('admitted', 'running')])
  })
})
