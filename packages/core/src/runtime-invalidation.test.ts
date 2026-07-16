/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify runtime invalidation carries facet identity and monotonic generation only.
 * 2. Verify ReactiveContext consumers track only the requested facets.
 * 3. Verify duplicate listener pushes coalesce consistently across subscribers.
 *
 * Original request (2026-07-15): "Push 通知变更，然后让多端基于订阅拉取更新。"
 */
import { describe, expect, it, vi } from 'vitest'
import { ReactiveContext } from './reactive-fs/reactive-context.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

describe('RuntimeInvalidationIndex', () => {
  it('invalidates only requested facets with monotonic generations', async () => {
    const index = new RuntimeInvalidationIndex()
    const context = new ReactiveContext()
    const stream = context.stream(async () => index.track('stores', 'context'))

    await expect(stream.next()).resolves.toMatchObject({
      value: [
        { facet: 'stores', generation: 0 },
        { facet: 'context', generation: 0 },
      ],
    })

    index.invalidate(['stores', 'context'])
    await expect(stream.next()).resolves.toMatchObject({
      value: [
        { facet: 'stores', generation: 1 },
        { facet: 'context', generation: 1 },
      ],
    })

    expect(index.current('worksets')).toBe(0)
    expect(index.current('schemas')).toBe(0)
    await stream.return(undefined)
  })

  it('notifies one listener once for one multi-facet invalidation', async () => {
    const index = new RuntimeInvalidationIndex()
    const listener = vi.fn()
    const release = index.subscribe(['stores', 'context'], listener)

    index.invalidate(['stores', 'context'])
    await Promise.resolve()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith([
      { facet: 'stores', generation: 1 },
      { facet: 'context', generation: 1 },
    ])

    release()
    index.invalidate(['stores'])
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('coalesces duplicate facets to the latest generation across subscribers', async () => {
    const index = new RuntimeInvalidationIndex()
    const allFacets = vi.fn()
    const storesOnly = vi.fn()
    index.subscribe(['stores', 'context'], allFacets)
    index.subscribe(['stores'], storesOnly)

    index.invalidate(['stores'])
    index.invalidate(['stores', 'context'])
    index.invalidate(['context'])
    await Promise.resolve()

    expect(allFacets).toHaveBeenCalledOnce()
    expect(allFacets).toHaveBeenCalledWith([
      { facet: 'stores', generation: 2 },
      { facet: 'context', generation: 2 },
    ])
    expect(storesOnly).toHaveBeenCalledOnce()
    expect(storesOnly).toHaveBeenCalledWith([{ facet: 'stores', generation: 2 }])
  })
})
