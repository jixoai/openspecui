import { describe, expect, it } from 'vitest'
import {
  getHostedApiBootstrapState,
  getHostedScopedStorageKey,
  isHostedVersionEntryPath,
} from './hosted-session'

describe('hosted-session helpers', () => {
  it('detects hosted version entry paths', () => {
    expect(isHostedVersionEntryPath('/versions/v2.1/index.html')).toBe(true)
    expect(isHostedVersionEntryPath('/dashboard')).toBe(false)
  })

  it('extracts api and session from hosted entry URLs', () => {
    expect(
      getHostedApiBootstrapState({
        pathname: '/versions/v2.1/index.html',
        search: '?api=http://localhost:3100/&session=session-a',
      })
    ).toEqual({
      hosted: true,
      apiBaseUrl: 'http://localhost:3100',
      sessionId: 'session-a',
    })
  })

  it('scopes browser keys by hosted session only inside version entries', () => {
    expect(
      getHostedScopedStorageKey('nav-layout', {
        pathname: '/versions/v2.1/dashboard',
        search: '?session=session-a',
      })
    ).toBe('hosted-session:session-a:nav-layout')
    expect(
      getHostedScopedStorageKey('nav-layout', {
        pathname: '/dashboard',
        search: '?session=session-a',
      })
    ).toBe('nav-layout')
  })
})
