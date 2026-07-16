/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove filesystem-backed entity ids cannot escape through path syntax.
 * 2. Prove entity-relative file and glob paths cannot traverse their entity root.
 * 3. Preserve valid opaque ids and relative paths without inventing a second CLI grammar.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 */
import { describe, expect, it } from 'vitest'
import { requireCanonicalOpenSpecEntityId, requireOpenSpecEntityRelativePath } from './entity-id.js'

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

describe('requireOpenSpecEntityRelativePath', () => {
  it.each([
    '../escaped.md',
    'work/../../escaped.md',
    '/absolute.md',
    '\\server\\share.md',
    'C:\\absolute.md',
    '',
  ])('rejects entity path escape %j', (value) => {
    expect(() => requireOpenSpecEntityRelativePath(value, 'outputPath')).toThrow(
      /Invalid outputPath/
    )
  })

  it('normalizes safe file and glob paths', () => {
    expect(requireOpenSpecEntityRelativePath('./work\\backend//tasks.md', 'path')).toBe(
      'work/backend/tasks.md'
    )
    expect(requireOpenSpecEntityRelativePath('specs/**/*.md', 'outputPath')).toBe('specs/**/*.md')
  })
})
