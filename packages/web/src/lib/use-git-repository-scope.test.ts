/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove static Git projections carry no live binding provenance.
 * 2. Preserve the typed distinction between static fallback and live repository scopes.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import { describe, expect, it } from 'vitest'
import { STATIC_GIT_SCOPES } from './use-git-repository-scope'

describe('static Git repository scope', () => {
  it('does not fabricate a live binding token', () => {
    expect(STATIC_GIT_SCOPES.code.bindingToken).toBeNull()
    expect(STATIC_GIT_SCOPES.planning).toBeNull()
  })
})
