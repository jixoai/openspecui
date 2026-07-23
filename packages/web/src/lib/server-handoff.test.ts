/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove a worktree navigation carries the current in-memory Access Gate only in the target fragment.
 * 2. Prove the child Project Web consumes and strips that credential before using protected transports.
 *
 * Original request (2026-07-24): "A protected parent must not hand off to an unreachable child."
 */
import type { GitWorktreeHandoff } from '@openspecui/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('protected worktree Server handoff', () => {
  afterEach(() => {
    vi.resetModules()
    window.history.replaceState({}, '', '/')
  })

  it('binds the parent memory credential to the child fragment and consumes it there', async () => {
    window.history.replaceState({}, '', '/git#credential=parent-secret')
    const parentCredentialOwner = await import('./access-gate-credential')
    expect(parentCredentialOwner.consumeAccessGateLaunchCredential()).toBe('parent-secret')
    expect(window.location.hash).toBe('')

    const handoff: GitWorktreeHandoff = {
      projectDir: '/repo/.worktrees/feature',
      serverUrl: 'http://127.0.0.1:3210',
    }
    const { buildServerHandoffHref } = await import('./server-handoff')
    const targetHref = buildServerHandoffHref({ handoff, location: window.location })
    const targetUrl = new URL(targetHref)

    expect(new URLSearchParams(targetUrl.hash.slice(1)).get('credential')).toBe('parent-secret')
    expect(targetUrl.search).not.toContain('parent-secret')
    expect(JSON.stringify(handoff)).not.toContain('parent-secret')

    vi.resetModules()
    window.history.replaceState({}, '', `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
    const childCredentialOwner = await import('./access-gate-credential')
    expect(childCredentialOwner.consumeAccessGateLaunchCredential()).toBe('parent-secret')
    expect(window.location.hash).toBe('')
  })
})
