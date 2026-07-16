/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove filesystem-backed entity ids cannot escape through path syntax.
 * 2. Preserve valid opaque single-segment ids without inventing a second CLI grammar.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 */
import { describe, expect, it } from 'vitest'
import { requireCanonicalOpenSpecEntityId } from './entity-id.js'

describe('requireCanonicalOpenSpecEntityId', () => {
  it.each(['../escaped', './nested', 'nested/change', 'nested\\change', '.', '..', ''])(
    'rejects non-canonical path input %j',
    (value) => {
      expect(() => requireCanonicalOpenSpecEntityId(value, 'changeId')).toThrow(/Invalid changeId/)
    }
  )

  it('preserves an opaque single path segment', () => {
    expect(requireCanonicalOpenSpecEntityId('add-search', 'specId')).toBe('add-search')
  })
})
