/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the current, terminal, and once gates at the production lifecycle composer.
 * 2. Prove settlement refreshes Store plus only exact-locator Context tabs.
 * 3. Prove reconnect can settle a previously observed active request without replaying history.
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
})
