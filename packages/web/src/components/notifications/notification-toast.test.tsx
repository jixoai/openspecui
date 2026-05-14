import type { NavState } from '@/lib/nav-controller'
import {
  NotificationContextProvider,
  type NotificationContextValue,
} from '@/lib/notifications/context'
import { groupNotifications, type NotificationRecord } from '@openspecui/core/notifications'
import type { HistoryLocation } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationToastViewport } from './notification-toast'

let currentNavState: NavState = {
  mainTabs: ['/dashboard', '/changes', '/terminal'],
  bottomTabs: ['/git'],
  mainLocation: location('/dashboard'),
  bottomLocation: location('/git'),
  popLocation: location('/'),
  bottomActive: true,
  popActive: false,
}

const { getLocalSessionIdForServerSessionMock, isSessionActiveMock, markReadMock, resolveRunMock } =
  vi.hoisted(() => ({
    getLocalSessionIdForServerSessionMock: vi.fn<(serverSessionId: string) => string | null>(),
    isSessionActiveMock: vi.fn<(localSessionId: string) => boolean>(),
    markReadMock: vi.fn<(id: string) => Promise<void>>(async () => undefined),
    resolveRunMock: vi.fn<() => Promise<void>>(async () => undefined),
  }))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactElement }) => children,
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => currentNavState,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: (path: string) => (path === '/terminal' ? 'bottom' : 'main'),
  },
}))

vi.mock('@/lib/terminal-controller', () => ({
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

function notification(input?: Partial<NotificationRecord>): NotificationRecord {
  return {
    id: 'n-1',
    title: 'Claude needs your permission',
    body: 'Allow Web Search',
    source: { type: 'terminal', sessionId: 'pty-1', title: 'claude' },
    actions: [
      {
        type: 'terminal.focus',
        label: 'Focus terminal',
        target: { sessionId: 'pty-1' },
      },
    ],
    level: 'info',
    createdAt: 100,
    groupKey: 'terminal:pty-1',
    ...input,
  }
}

function renderToast(notifications: NotificationRecord[]) {
  const context: NotificationContextValue = {
    notifications,
    latestNotification: notifications[0] ?? null,
    groups: groupNotifications(notifications),
    unreadCount: notifications.length,
    highlightedId: null,
    browserSupported: false,
    browserPermission: 'unsupported',
    panelOpen: false,
    openPanel: () => undefined,
    requestBrowserPermission: async () => 'unsupported',
    previewSound: async () => undefined,
    resolveAction: (_notification, action) => ({
      action,
      disabled: false,
      run: resolveRunMock,
    }),
    markRead: markReadMock,
    markManyRead: async () => undefined,
    clearGroup: async () => undefined,
    clearAll: async () => undefined,
    clearTerminalSession: async () => undefined,
  }

  return render(
    <NotificationContextProvider value={context}>
      <NotificationToastViewport />
    </NotificationContextProvider>
  )
}

describe('NotificationToastViewport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    currentNavState = {
      mainTabs: ['/dashboard', '/changes', '/terminal'],
      bottomTabs: ['/git'],
      mainLocation: location('/dashboard'),
      bottomLocation: location('/git'),
      popLocation: location('/'),
      bottomActive: true,
      popActive: false,
    }
    getLocalSessionIdForServerSessionMock.mockReturnValue('term-1')
    isSessionActiveMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    getLocalSessionIdForServerSessionMock.mockReset()
    isSessionActiveMock.mockReset()
    markReadMock.mockClear()
    resolveRunMock.mockClear()
  })

  it('renders a compact toast for a new notification and hides the read action label', async () => {
    const { container } = renderToast([notification()])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    const expectedTime = new Date(100).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(screen.getByText('Allow Web Search')).toBeTruthy()
    expect(screen.queryByText('Claude needs your permission')).toBeNull()
    expect(screen.getByText(`${expectedTime} - 1 unread`)).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'http://localhost:3000/icon.rounded.svg'
    )
    expect(screen.getByRole('button', { name: 'Focus terminal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Focus terminal' }).className).toContain('bg-primary')
    expect(screen.queryByRole('button', { name: 'Read' })).toBeNull()
  })

  it('falls back to the notification title when the latest message has no body', async () => {
    renderToast([notification({ body: '' })])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    expect(screen.getByText('Claude needs your permission')).toBeTruthy()
  })

  it('does not render when the notification target is already open', async () => {
    currentNavState = {
      ...currentNavState,
      bottomLocation: location('/terminal'),
    }
    isSessionActiveMock.mockReturnValue(true)

    renderToast([notification()])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    expect(screen.queryByText('Claude needs your permission')).toBeNull()
  })

  it('starts the close animation when the notification is read elsewhere', async () => {
    const { rerender } = renderToast([notification()])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    rerender(
      <NotificationContextProvider
        value={{
          notifications: [],
          latestNotification: null,
          groups: [],
          unreadCount: 0,
          highlightedId: null,
          browserSupported: false,
          browserPermission: 'unsupported',
          panelOpen: false,
          openPanel: () => undefined,
          requestBrowserPermission: async () => 'unsupported',
          previewSound: async () => undefined,
          resolveAction: (_notification, action) => ({
            action,
            disabled: false,
            run: resolveRunMock,
          }),
          markRead: markReadMock,
          markManyRead: async () => undefined,
          clearGroup: async () => undefined,
          clearAll: async () => undefined,
          clearTerminalSession: async () => undefined,
        }}
      >
        <NotificationToastViewport />
      </NotificationContextProvider>
    )

    const toast = screen.getByText('Allow Web Search').closest('[data-state]')
    expect(toast?.getAttribute('data-state')).toBe('closed')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(360)
    })
    expect(screen.queryByText('Claude needs your permission')).toBeNull()
  })

  it('marks the notification read from the icon-only dismiss action', async () => {
    renderToast([notification({ actions: [] })])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    expect(screen.getByRole('button', { name: 'Dismiss notification' }).className).toContain(
      'bg-primary'
    )
    expect(markReadMock).toHaveBeenCalledWith('n-1')
  })
})
