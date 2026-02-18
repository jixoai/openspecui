import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchIndex } from './engine.js'

describe('search engine', () => {
  it('returns results sorted by score and updatedAt', () => {
    const index = buildSearchIndex([
      {
        id: 'spec:auth',
        kind: 'spec',
        title: 'Authentication',
        href: '/specs/auth',
        path: 'openspec/specs/auth/spec.md',
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
    expect(hits[1]?.documentId).toBe('spec:auth')
  })

  it('returns empty for blank queries', () => {
    const index = buildSearchIndex([])
    expect(searchIndex(index, { query: '   ' })).toEqual([])
  })
})
