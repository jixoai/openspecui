import { describe, expect, it } from 'vitest'
import { getHostedApiBootstrapState, getHostedScopedStorageKey } from './hosted-session'

describe('hosted-session helpers', () => {
  it('extracts api and session from hosted entry URLs', () => {
    expect(
      getHostedApiBootstrapState({
        search: '?api=http://localhost:3100/&session=session-a',
      })
    ).toEqual({
      hosted: true,
      apiBaseUrl: 'http://localhost:3100',
      sessionId: 'session-a',
    })
  })

  it('uses same-origin mode when no session is provided', () => {
    expect(
      getHostedApiBootstrapState({
        search: '?api=http://localhost:3100/',
      })
    ).toEqual({
      hosted: false,
      apiBaseUrl: 'http://localhost:3100',
      sessionId: null,
    })
  })

  it('scopes browser keys by hosted session whenever a session exists', () => {
    expect(
      getHostedScopedStorageKey('nav-layout', {
        search: '?session=session-a',
      })
    ).toBe('hosted-session:session-a:nav-layout')
    expect(
      getHostedScopedStorageKey('nav-layout', {
        search: '?session=session-a',
      })
    ).toBe('hosted-session:session-a:nav-layout')
    expect(
      getHostedScopedStorageKey('nav-layout', {
        search: '',
      })
    ).toBe('nav-layout')
  })
})
