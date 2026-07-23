/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the realtime atoms never synthesize a Live/push/revalidation state from a static snapshot.
 * 2. Prove a static snapshot renders as `current` (or `empty`), never `revalidating`/`initial-loading`.
 *
 * Original request (2026-07-23): "静态模式……绝不伪造 Live、push、reconnect 或 revalidation 活动。"
 * Evidence type: unit (focused Vitest lane). P5 static-truthfulness proof.
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

describe('static snapshot truthfulness', () => {
  it('renders a settled static snapshot as current, never revalidating or initial-loading', () => {
    // A static export resolves data synchronously: no loading, no updating, authority current.
    const state = deriveProjectionState(
      base<string[]>({ data: ['spec-a'], authority: 'current', cause: 'initial' })
    )
    expect(state.topology).toBe('current')
    expect(state.topology).not.toBe('revalidating')
    expect(state.topology).not.toBe('initial-loading')
    expect(state.authority).toBe('current')
  })

  it('never synthesizes a server-push cause from a static snapshot', () => {
    const state = deriveProjectionState(
      base<string[]>({ data: ['spec-a'], authority: 'current', cause: 'initial' })
    )
    expect(state.cause).not.toBe('server-push')
    expect(state.cause).not.toBe('reconnect')
  })

  it('renders a static empty snapshot as empty, not as an unresolved loading state', () => {
    const state = deriveProjectionState(
      base<string[]>({ data: [], authority: 'current', cause: 'initial' })
    )
    expect(state.topology).toBe('empty')
    expect(state.topology).not.toBe('initial-loading')
  })
})
