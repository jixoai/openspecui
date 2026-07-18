/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prove static Git projections carry no live binding provenance.
 * 2. Preserve the typed distinction between static fallback and live repository scopes.
 * 3. Prove the Git-only cache rebind policy keeps cached scopes non-authoritative until B emits.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 requires mutation-resistant reconnect evidence.
 */
import type { GitRepositoryScopes } from '@openspecui/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { primeSubscriptionCache } from './use-subscription'
import { STATIC_GIT_SCOPES, useGitRepositoryScopes } from './use-git-repository-scope'

type ScopeCallbacks = {
  onData(data: GitRepositoryScopes): void
  onError(error: Error): void
}

const { staticModeMock, subscribeMock } = vi.hoisted(() => ({
  staticModeMock: vi.fn(() => false),
  subscribeMock: vi.fn<
    (input: undefined, callbacks: ScopeCallbacks) => { unsubscribe: () => void }
  >(),
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
    expect(callbacks).toBeDefined()

    act(() => callbacks?.onData(scopeB))

    expect(result.current).toMatchObject({ data: scopeB, isLoading: false, error: null })
  })
})
