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
