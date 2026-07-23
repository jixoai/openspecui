/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the eight-topology derivation law covers every named state and transition.
 * 2. Prove an unresolved request is never labeled as an empty result.
 * 3. Prove unknown totals never become percentages/ETA (atoms render indeterminate only).
 * 4. Prove readable content stays visible with display-only authority during revalidation.
 *
 * Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是。"
 * Evidence type: unit (focused Vitest lane). Owner browser acceptance remains separate.
 */
import { describe, expect, it } from 'vitest'

import { deriveProjectionState, type RealtimeProjectionInput } from './state'

function base<T>(overrides: Partial<RealtimeProjectionInput<T>>): RealtimeProjectionInput<T> {
  return {
    data: undefined,
    isLoading: false,
    isUpdating: false,
    error: null,
    authority: 'display-only',
    cause: 'initial',
    progress: null,
    ...overrides,
  }
}

describe('deriveProjectionState no-content topology', () => {
  it('renders idle when nothing has been requested', () => {
    const state = deriveProjectionState(base<string>({}))
    expect(state.topology).toBe('idle')
    expect(state.authority).toBe('display-only')
  })

  it('renders initial-loading for an unresolved first request, never empty', () => {
    const state = deriveProjectionState(base<string>({ isLoading: true }))
    expect(state.topology).toBe('initial-loading')
    expect(state.topology).not.toBe('empty')
  })

  it('renders initial-error when the first request failed with no readable content', () => {
    const state = deriveProjectionState(
      base<string>({ error: new Error('boom'), isLoading: false })
    )
    expect(state.topology).toBe('initial-error')
  })

  it('renders empty only for a current committed projection with no items', () => {
    const state = deriveProjectionState(base<string[]>({ data: [], authority: 'current' }))
    expect(state.topology).toBe('empty')
    expect(state.authority).toBe('current')
  })

  it('does not label an unresolved request as empty even with an empty-ish predicate', () => {
    const state = deriveProjectionState(base<string[]>({ isLoading: true }), {
      isEmpty: (d) => d.length === 0,
    })
    expect(state.topology).toBe('initial-loading')
  })
})

describe('deriveProjectionState content topology', () => {
  it('renders current for settled authoritative content', () => {
    const state = deriveProjectionState(base<string[]>({ data: ['a'], authority: 'current' }))
    expect(state.topology).toBe('current')
    expect(state.authority).toBe('current')
  })

  it('renders revalidating over readable content while updating', () => {
    const state = deriveProjectionState(
      base<string[]>({ data: ['a'], isUpdating: true, authority: 'current' })
    )
    expect(state.topology).toBe('revalidating')
    expect(state.authority).toBe('display-only')
    expect(state.data).toEqual(['a'])
  })

  it('renders revalidating over readable content when isLoading but data present', () => {
    const state = deriveProjectionState(base<string[]>({ data: ['a'], isLoading: true }))
    expect(state.topology).toBe('revalidating')
    expect(state.data).toEqual(['a'])
  })

  it('renders refresh-error over readable content with an error', () => {
    const state = deriveProjectionState(
      base<string[]>({ data: ['a'], error: new Error('refresh failed') })
    )
    expect(state.topology).toBe('refresh-error')
    expect(state.data).toEqual(['a'])
  })

  it('renders partial when known progress is incomplete', () => {
    const state = deriveProjectionState(
      base<string[]>({
        data: ['a'],
        authority: 'current',
        progress: { completed: 1, total: 3 },
      })
    )
    expect(state.topology).toBe('partial')
    expect(state.progress).toEqual({ completed: 1, total: 3 })
  })

  it('renders partial with indeterminate progress when total is unknown (no fabricated %)', () => {
    const state = deriveProjectionState(
      base<string[]>({
        data: ['a'],
        authority: 'current',
        progress: { completed: 5, total: 'unknown' },
      })
    )
    expect(state.topology).toBe('partial')
    expect(state.progress?.total).toBe('unknown')
  })
})

describe('deriveProjectionState named transitions', () => {
  it('current -> revalidating -> current', () => {
    let state = deriveProjectionState(base<string[]>({ data: ['a'], authority: 'current' }))
    expect(state.topology).toBe('current')
    state = deriveProjectionState(base<string[]>({ data: ['a'], isUpdating: true }))
    expect(state.topology).toBe('revalidating')
    state = deriveProjectionState(base<string[]>({ data: ['b'], authority: 'current' }))
    expect(state.topology).toBe('current')
  })

  it('current -> revalidating -> refresh-error (retains content)', () => {
    let state = deriveProjectionState(base<string[]>({ data: ['a'], authority: 'current' }))
    expect(state.topology).toBe('current')
    state = deriveProjectionState(base<string[]>({ data: ['a'], isUpdating: true }))
    expect(state.topology).toBe('revalidating')
    state = deriveProjectionState(base<string[]>({ data: ['a'], error: new Error('x') }))
    expect(state.topology).toBe('refresh-error')
    expect(state.data).toEqual(['a'])
  })

  it('display-only authority over readable content yields revalidating, not current', () => {
    const state = deriveProjectionState(base<string[]>({ data: ['a'], authority: 'display-only' }))
    expect(state.topology).toBe('revalidating')
    expect(state.authority).toBe('display-only')
  })
})
