/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify deterministic matching, scoring, ordering, and limits.
 * 2. Verify project scope filtering precedes matching, scoring, sorting, and limits.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchIndex } from './engine.js'

describe('search engine', () => {
  it('returns results sorted by score and updatedAt', () => {
    const index = buildSearchIndex([
      {
        id: 'spec:owned:auth',
        kind: 'spec',
        title: 'Authentication',
        href: '/specs/owned/auth',
        path: 'owned:openspec/specs/auth/spec.md',
        content: 'Authentication requirements and login flow',
        updatedAt: 10,
      },
      {
        id: 'change:add-auth',
        kind: 'change',
        title: 'Add auth flow',
        href: '/changes/add-auth',
        path: 'openspec/changes/add-auth/proposal.md',
        content: 'Implement authentication and oauth integration',
        updatedAt: 20,
      },
    ])

    const hits = searchIndex(index, { query: 'auth', limit: 10 })

    expect(hits).toHaveLength(2)
    expect(hits[0]?.documentId).toBe('change:add-auth')
    expect(hits[1]?.documentId).toBe('spec:owned:auth')
  })

  it('returns empty for blank queries', () => {
    const index = buildSearchIndex([])
    expect(searchIndex(index, { query: '   ' })).toEqual([])
  })

  it('filters by project scope before scoring and limiting results', () => {
    const index = buildSearchIndex([
      {
        id: 'spec:owned:auth',
        kind: 'spec',
        scope: 'active-root',
        title: 'Authentication authentication',
        href: '/specs/owned/auth',
        path: 'openspec/specs/auth/spec.md',
        content: 'authentication',
        updatedAt: 20,
      },
      {
        id: 'spec:reference:platform:auth',
        kind: 'spec',
        scope: 'referenced-specs',
        title: 'Authentication',
        href: '/specs/reference/platform/auth',
        path: 'reference:platform:openspec/specs/auth/spec.md',
        content: 'authentication',
        updatedAt: 10,
      },
    ])

    expect(
      searchIndex(index, { query: 'authentication', scope: 'referenced-specs', limit: 1 })
    ).toEqual([
      expect.objectContaining({
        documentId: 'spec:reference:platform:auth',
        scope: 'referenced-specs',
      }),
    ])
  })
})
