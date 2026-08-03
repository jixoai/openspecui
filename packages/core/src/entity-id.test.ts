/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove filesystem-backed entity ids cannot escape through path syntax.
 * 2. Prove entity-relative file and glob paths cannot traverse their entity root.
 * 3. Preserve recursive Spec ids without weakening single-segment Change ids.
 * 4. Reject raw and encoded traversal before filesystem access.
 *
 * Original request (2026-07-16): "实际文件变更只能发生在选定的 planning root 内。"
 */
import { describe, expect, it } from 'vitest'
import {
  requireCanonicalOpenSpecEntityId,
  requireCanonicalOpenSpecSpecId,
  requireOpenSpecEntityRelativePath,
} from './entity-id.js'

describe('requireCanonicalOpenSpecEntityId', () => {
  it.each([
    '../escaped',
    './nested',
    'nested/change',
    'nested\\change',
    '.',
    '..',
    '',
    ' leading-space',
    'trailing-space ',
    'nul\0change',
  ])('rejects non-canonical path input %j', (value) => {
    expect(() => requireCanonicalOpenSpecEntityId(value, 'changeId')).toThrow(/Invalid changeId/)
  })

  it('preserves an opaque single path segment', () => {
    expect(requireCanonicalOpenSpecEntityId('add-search', 'changeId')).toBe('add-search')
  })
})

describe('requireCanonicalOpenSpecSpecId', () => {
  it('preserves every recursive Spec identity segment', () => {
    expect(requireCanonicalOpenSpecSpecId('platform/auth')).toBe('platform/auth')
    expect(requireCanonicalOpenSpecSpecId('platform/auth flows')).toBe('platform/auth flows')
  })

  it.each([
    '../escaped',
    './nested',
    'nested//spec',
    '/absolute',
    '\\server\\share',
    'C:\\absolute',
    'nested/../escaped',
    'nested/./spec',
    'nested/',
    '%2e%2e%2fescaped',
    '%252e%252e%252fescaped',
    '%2525252e%2525252e%2525252fescaped',
    'nested%2f..%2fescaped',
    '',
    ' leading-space',
    'trailing-space ',
    'nul\0spec',
  ])('rejects recursive Spec traversal input %j', (value) => {
    expect(() => requireCanonicalOpenSpecSpecId(value)).toThrow(/Invalid specId/)
  })

  it('rejects excessive identity length and encoding depth before recursive decoding can monopolize the event loop', () => {
    let deeplyEncoded = '../escaped'
    for (let depth = 0; depth < 10; depth += 1) {
      deeplyEncoded = encodeURIComponent(deeplyEncoded)
    }

    expect(() => requireCanonicalOpenSpecSpecId('a'.repeat(4097))).toThrow(/length/)
    expect(() => requireCanonicalOpenSpecSpecId(deeplyEncoded)).toThrow(/decode depth/)
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
