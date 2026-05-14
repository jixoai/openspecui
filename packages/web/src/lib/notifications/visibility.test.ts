import type { NotificationRecord } from '@openspecui/core/notifications'
import type { HistoryLocation } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NavState } from '../nav-controller'
import {
  notificationActionTargetIsOpen,
  notificationTargetPath,
  routeIsOpen,
  shouldShowNotificationToast,
} from './visibility'

const { getLocalSessionIdForServerSessionMock, isSessionActiveMock } = vi.hoisted(() => ({
  getLocalSessionIdForServerSessionMock: vi.fn<(serverSessionId: string) => string | null>(),
  isSessionActiveMock: vi.fn<(localSessionId: string) => boolean>(),
}))

vi.mock('../terminal-controller', () => ({
  terminalController: {
    getLocalSessionIdForServerSession: (serverSessionId: string) =>
      getLocalSessionIdForServerSessionMock(serverSessionId),
    isSessionActive: (localSessionId: string) => isSessionActiveMock(localSessionId),
  },
}))

function location(pathname: string): HistoryLocation {
  return {
    href: pathname,
    pathname,
    search: '',
    hash: '',
    state: { __TSR_index: 0, key: pathname, __TSR_key: pathname },
  }
}

function navState(input?: Partial<NavState>): NavState {
  return {
    mainTabs: ['/dashboard', '/changes', '/terminal'],
    bottomTabs: ['/git'],
    mainLocation: location('/dashboard'),
    bottomLocation: location('/git'),
    popLocation: location('/'),
    bottomActive: true,
    popActive: false,
    ...input,
  }
}

function terminalNotification(sessionId = 'pty-1'): NotificationRecord {
  return {
    id: 'n-1',
    title: 'Claude needs your permission',
    body: 'Allow Web Search',
    source: { type: 'terminal', sessionId, title: 'claude' },
    actions: [
      {
        type: 'terminal.focus',
        label: 'Focus terminal',
        target: { sessionId },
      },
    ],
    level: 'info',
    createdAt: 100,
    groupKey: `terminal:${sessionId}`,
  }
}

function hrefNotification(href: string): NotificationRecord {
  return {
    id: 'n-2',
    title: 'Change updated',
    body: '',
    source: { type: 'openspec-change', changeId: 'demo', title: 'demo' },
    actions: [{ type: 'href.open', label: 'Open', target: { href } }],
    level: 'info',
    createdAt: 100,
    groupKey: 'openspec-change:demo',
  }
}

describe('notification target visibility', () => {
  afterEach(() => {
    getLocalSessionIdForServerSessionMock.mockReset()
    isSessionActiveMock.mockReset()
  })

  it('matches routes in main and bottom areas', () => {
    const layout = navState({
      mainLocation: location('/changes/demo'),
      bottomLocation: location('/terminal'),
    })

    expect(routeIsOpen(layout, '/changes')).toBe(true)
    expect(routeIsOpen(layout, '/terminal')).toBe(true)
    expect(routeIsOpen(layout, '/archive')).toBe(false)
  })

  it('resolves the primary target path from typed actions', () => {
    expect(notificationTargetPath(hrefNotification('/changes/demo'))).toBe('/changes/demo')
    expect(notificationTargetPath(terminalNotification())).toBe('/terminal')
  })

  it('suppresses toast while the NotificationsPanel is open', () => {
    const layout = navState({
      popActive: true,
      popLocation: location('/notifications'),
    })

    expect(
      shouldShowNotificationToast({
        notification: hrefNotification('/archive'),
        navLayout: layout,
      })
    ).toBe(false)
  })

  it('suppresses toast when a href action target is already open', () => {
    const layout = navState({ mainLocation: location('/changes/demo') })
    const notification = hrefNotification('/changes/demo')

    expect(notificationActionTargetIsOpen(layout, notification)).toBe(true)
    expect(shouldShowNotificationToast({ notification, navLayout: layout })).toBe(false)
  })

  it('shows toast when a href action target is not open', () => {
    const layout = navState({ mainLocation: location('/dashboard') })

    expect(
      shouldShowNotificationToast({
        notification: hrefNotification('/changes/demo'),
        navLayout: layout,
      })
    ).toBe(true)
  })

  it('suppresses toast when the terminal target is the active visible terminal tab', () => {
    getLocalSessionIdForServerSessionMock.mockReturnValue('term-1')
    isSessionActiveMock.mockReturnValue(true)
    const layout = navState({ bottomLocation: location('/terminal') })
    const notification = terminalNotification()

    expect(notificationActionTargetIsOpen(layout, notification)).toBe(true)
    expect(shouldShowNotificationToast({ notification, navLayout: layout })).toBe(false)
  })

  it('shows toast when terminal panel is visible but another terminal tab is active', () => {
    getLocalSessionIdForServerSessionMock.mockReturnValue('term-1')
    isSessionActiveMock.mockReturnValue(false)
    const layout = navState({ bottomLocation: location('/terminal') })

    expect(
      shouldShowNotificationToast({
        notification: terminalNotification(),
        navLayout: layout,
      })
    ).toBe(true)
  })
})
