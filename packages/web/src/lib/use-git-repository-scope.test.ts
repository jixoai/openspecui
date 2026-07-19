/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove static Git projections carry no live binding provenance.
 * 2. Preserve the typed distinction between static fallback and live repository scopes.
 * 3. Prove the Git-only cache rebind policy keeps cached scopes non-authoritative until B emits.
 * 4. Drive transport connecting, pending, and error authority through the real tRPC observer.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 requires mutation-resistant reconnect evidence.
 */
import type { GitRepositoryScopes } from '@openspecui/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STATIC_GIT_SCOPES, useGitRepositoryScopes } from './use-git-repository-scope'
import { primeSubscriptionCache } from './use-subscription'

type ScopeCallbacks = {
  onData(data: GitRepositoryScopes): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
}

const { staticModeMock, subscribeMock } = vi.hoisted(() => ({
  staticModeMock: vi.fn(() => false),
  subscribeMock:
    vi.fn<(input: undefined, callbacks: ScopeCallbacks) => { unsubscribe: () => void }>(),
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: staticModeMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    git: {
      subscribeScopes: {
        subscribe: subscribeMock,
      },
    },
  },
}))

function liveScopes(bindingToken: string): GitRepositoryScopes {
  return {
    defaultScope: 'code',
    code: {
      scope: 'code',
      bindingToken,
      rootPath: `/workspace/${bindingToken}`,
      repository: {
        topLevel: `/workspace/${bindingToken}`,
        commonDir: `/workspace/${bindingToken}/.git`,
      },
    },
    planningState: 'settled',
    planning: null,
  }
}

describe('static Git repository scope', () => {
  beforeEach(() => {
    staticModeMock.mockReturnValue(false)
    subscribeMock.mockReset()
  })

  it('does not fabricate a live binding token', () => {
    expect(STATIC_GIT_SCOPES.code.bindingToken).toBeNull()
    expect(STATIC_GIT_SCOPES.planning).toBeNull()
  })

  it('keeps cached A non-authoritative until the real Git subscription emits B', () => {
    const scopeA = liveScopes('code-binding-a')
    const scopeB = liveScopes('code-binding-b')
    let callbacks: ScopeCallbacks | undefined
    subscribeMock.mockImplementation((_input, next) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('git.subscribeScopes', scopeA)

    const { result } = renderHook(() => useGitRepositoryScopes())

    expect(result.current.data).toEqual(scopeA)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.authority).toEqual({ state: 'waiting', reason: 'rebind' })
    expect(callbacks).toBeDefined()

    act(() => callbacks?.onData(scopeB))

    expect(result.current).toMatchObject({
      data: scopeB,
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
  })

  it('revokes cached authority for real transport states and terminal errors until B emits', () => {
    const scopeA = liveScopes('code-binding-a')
    const scopeB: GitRepositoryScopes = {
      ...liveScopes('code-binding-b'),
      planningState: 'resolving',
      planning: null,
    }
    let callbacks: ScopeCallbacks | undefined
    subscribeMock.mockImplementation((_input, next) => {
      callbacks = next
      return { unsubscribe: vi.fn() }
    })
    primeSubscriptionCache('git.subscribeScopes', scopeA)

    const { result } = renderHook(() => useGitRepositoryScopes())

    act(() => callbacks?.onConnectionStateChange({ state: 'connecting', error: null }))
    expect(result.current).toMatchObject({
      data: scopeA,
      authority: { state: 'waiting', reason: 'connecting' },
    })

    act(() => callbacks?.onConnectionStateChange({ state: 'pending', error: null }))
    expect(result.current).toMatchObject({
      data: scopeA,
      authority: { state: 'waiting', reason: 'pending' },
    })

    const transportError = new Error('transport disconnected')
    act(() => callbacks?.onError(transportError))
    expect(result.current).toMatchObject({
      data: scopeA,
      isLoading: false,
      error: transportError,
      authority: { state: 'failed', error: transportError },
    })

    act(() => callbacks?.onData(scopeB))
    expect(result.current).toMatchObject({
      data: scopeB,
      error: null,
      authority: { state: 'current' },
    })
  })
})
