/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove the base-path algebra in one place: normalization, stripping and application.
 * 2. Prove a resolved href loses the base path exactly once (issue #319 #4).
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */
import { describe, expect, it } from 'vitest'
import {
  applyBasePath,
  normalizeBasePath,
  stripBasePath,
  toBaseRelativeHref,
} from './base-path-href'

describe('base path algebra', () => {
  it.each([
    ['/', '/'],
    ['', '/'],
    ['./', '/'],
    ['.', '/'],
    ['/docs/', '/docs/'],
    ['docs', '/docs/'],
    ['/docs', '/docs/'],
    ['/pages/my-org/my-repo/', '/pages/my-org/my-repo/'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected)
  })

  it.each([
    ['/docs/specs', '/docs/', '/specs'],
    ['/docs/', '/docs/', '/'],
    ['/docs', '/docs/', '/'],
    ['/specs', '/docs/', '/specs'],
    ['/specs', '/', '/specs'],
    ['/', '/', '/'],
  ])('strips %s against %s to %s', (pathname, basePath, expected) => {
    expect(stripBasePath(pathname, basePath)).toBe(expected)
  })

  it('applies the base path symmetrically', () => {
    expect(applyBasePath('/specs', '/docs/')).toBe('/docs/specs')
    expect(applyBasePath('/', '/docs/')).toBe('/docs')
    expect(applyBasePath('/specs', '/')).toBe('/specs')
  })

  it('projects a resolved href onto one base-relative path', () => {
    expect(toBaseRelativeHref('/docs/specs', '/docs/')).toBe('/specs')
    expect(toBaseRelativeHref('/docs/changes/a?tab=evidence', '/docs/')).toBe(
      '/changes/a?tab=evidence'
    )
    expect(toBaseRelativeHref('/docs/specs#scenario', '/docs/')).toBe('/specs#scenario')
    expect(toBaseRelativeHref('/specs', '/')).toBe('/specs')
  })
})
