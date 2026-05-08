import { describe, expect, it } from 'vitest'
import { getSessionScopedStorageKey } from './storage-namespace'

describe('storage namespace helpers', () => {
  it('scopes hosted sessions by session', () => {
    expect(
      getSessionScopedStorageKey('xtermInputPanelState', {
        pathname: '/dashboard',
        search: '?session=session-a',
      })
    ).toBe('hosted-session:session-a:xtermInputPanelState')
  })

  it('keeps non-hosted keys unchanged', () => {
    expect(
      getSessionScopedStorageKey('xtermInputPanelState', {
        pathname: '/dashboard',
        search: '',
      })
    ).toBe('xtermInputPanelState')
  })
})
