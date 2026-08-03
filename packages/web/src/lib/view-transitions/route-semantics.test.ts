/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Prove route families and levels match the visible application hierarchy.
 * 2. Prove top, detail, and pop navigation resolve to the intended transition contract.
 * 3. Keep route normalization edge cases covered without browser-owned animation assertions.
 *
 * Original request (2026-08-03): make every Config owner-to-owner navigation use View Transitions.
 */
import { describe, expect, it } from 'vitest'
import { describeRouteSemantic, resolveViewTransitionIntent } from './route-semantics'

describe('describeRouteSemantic', () => {
  it('classifies known detail routes by family and level', () => {
    expect(
      describeRouteSemantic('/changes/extract-svelte-components-layout-foundation')
    ).toMatchObject({
      family: 'changes',
      level: 'detail',
    })
  })

  it('classifies owned and referenced compound Spec routes as one detail family', () => {
    expect(describeRouteSemantic('/specs/owned/auth')).toMatchObject({
      family: 'specs',
      level: 'detail',
    })
    expect(describeRouteSemantic('/specs/referenced/platform/auth')).toMatchObject({
      family: 'specs',
      level: 'detail',
    })
  })

  it('classifies every Config owner and Schema entity as Config detail', () => {
    for (const path of [
      '/config/project',
      '/config/root',
      '/config/environment',
      '/config/agents',
      '/config/schemas',
      '/config/schemas/project%2Fschema',
      '/config/context',
    ]) {
      expect(describeRouteSemantic(path)).toMatchObject({
        family: 'config',
        level: 'detail',
      })
    }
  })
})

describe('resolveViewTransitionIntent', () => {
  it('treats top-level route switches as route-top transitions', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/changes',
        toPath: '/archive',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-top',
      direction: 'forward',
    })
  })

  it('treats top-to-detail navigation as a forward detail transition', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/changes',
        toPath: '/changes/extract-svelte-components-layout-foundation',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-detail',
      direction: 'forward',
    })
  })

  it('keeps compound Spec navigation in the detail transition family', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/specs',
        toPath: '/specs/referenced/platform/auth',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-detail',
      direction: 'forward',
    })
  })

  it('keeps Config owner-to-owner navigation in the detail transition family', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/config/project',
        toPath: '/config/agents',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-detail',
      direction: 'forward',
    })
  })

  it('treats detail-to-top navigation as a backward detail transition', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/changes/extract-svelte-components-layout-foundation',
        toPath: '/changes',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-detail',
      direction: 'backward',
    })
  })

  it('treats unrelated detail-to-top navigation as a top-level transition', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/changes/extract-svelte-components-layout-foundation',
        toPath: '/archive',
      })
    ).toEqual({
      area: 'main',
      kind: 'route-top',
      direction: 'forward',
    })
  })

  it('skips VT intents for pop routes', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'main',
        fromPath: '/changes',
        toPath: '/search',
      })
    ).toBeNull()
  })

  it('treats pop activation as a forward route-top transition', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'pop',
        fromPath: '/',
        toPath: '/search',
      })
    ).toEqual({
      area: 'pop',
      kind: 'route-top',
      direction: 'forward',
    })
  })

  it('gives notifications the same pop transition semantics as search', () => {
    expect(describeRouteSemantic('/notifications')).toMatchObject({
      family: 'notifications',
      level: 'pop',
    })
    expect(
      resolveViewTransitionIntent({
        area: 'pop',
        fromPath: '/',
        toPath: '/notifications',
      })
    ).toEqual({
      area: 'pop',
      kind: 'route-top',
      direction: 'forward',
    })
  })

  it('treats pop dismissal as a backward route-top transition', () => {
    expect(
      resolveViewTransitionIntent({
        area: 'pop',
        fromPath: '/search',
        toPath: '/',
      })
    ).toEqual({
      area: 'pop',
      kind: 'route-top',
      direction: 'backward',
    })
  })
})
