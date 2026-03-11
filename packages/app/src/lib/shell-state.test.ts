import { describe, expect, it } from 'vitest'
import {
  applyHostedLaunchRequest,
  buildHostedVersionEntryUrl,
  createEmptyHostedShellState,
  getHostedTabLabel,
  parseHostedShellState,
  removeHostedTab,
} from './shell-state'

describe('hosted shell state helpers', () => {
  it('creates and deduplicates hosted tabs by api', () => {
    const initial = createEmptyHostedShellState()
    const next = applyHostedLaunchRequest(
      initial,
      {
        apiBaseUrl: 'http://localhost:13000',
      },
      {
        now: 1,
        sessionId: 'session-a',
      }
    )
    const duplicate = applyHostedLaunchRequest(
      next,
      {
        apiBaseUrl: 'http://localhost:13000',
      },
      {
        now: 2,
        sessionId: 'session-b',
      }
    )

    expect(next.tabs).toHaveLength(1)
    expect(duplicate.tabs).toHaveLength(1)
    expect(duplicate.activeTabId).toBe('session-a')
  })

  it('builds iframe entry URLs with api and session', () => {
    expect(
      buildHostedVersionEntryUrl(
        {
          id: 'session-a',
          sessionId: 'session-a',
          apiBaseUrl: 'http://localhost:13000',
          createdAt: 1,
        },
        'v2.1'
      )
    ).toBe('/versions/v2.1/index.html?api=http%3A%2F%2Flocalhost%3A13000&session=session-a')
  })

  it('normalizes persisted state and keeps the first tab active when activeTabId is invalid', () => {
    const parsed = parseHostedShellState({
      activeTabId: 'missing',
      tabs: [
        {
          id: 'session-a',
          sessionId: 'session-a',
          apiBaseUrl: 'http://localhost:13000/',
          createdAt: 1,
        },
      ],
    })

    expect(parsed.activeTabId).toBe('session-a')
    expect(parsed.tabs[0]?.apiBaseUrl).toBe('http://localhost:13000')
  })

  it('picks a nearby tab when the active tab is removed', () => {
    const state = {
      activeTabId: 'b',
      tabs: [
        {
          id: 'a',
          sessionId: 'a',
          apiBaseUrl: 'http://localhost:13000',
          createdAt: 1,
        },
        {
          id: 'b',
          sessionId: 'b',
          apiBaseUrl: 'http://localhost:13001',
          createdAt: 2,
        },
      ],
    }

    expect(removeHostedTab(state, 'b').activeTabId).toBe('a')
  })

  it('derives readable labels from api URLs', () => {
    expect(getHostedTabLabel({ apiBaseUrl: 'http://127.0.0.1:3100' })).toBe('127.0.0.1:3100')
  })
})
