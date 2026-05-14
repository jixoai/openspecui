import { DEFAULT_CONFIG, type OpenSpecUIConfig } from '@openspecui/core'
import type { NotificationAction, NotificationRecord } from '@openspecui/core/notifications'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationProvider, useNotifications } from './context'

const {
  activateBottomMock,
  deactivatePopMock,
  hasServerSessionMock,
  markReadMock,
  pushMock,
  requestActivateServerSessionMock,
  useNavLayoutMock,
} = vi.hoisted(() => ({
  activateBottomMock: vi.fn<(href: string) => Promise<void>>(async () => undefined),
  deactivatePopMock: vi.fn(async () => undefined),
  hasServerSessionMock: vi.fn<(serverSessionId: string) => boolean>(() => true),
  markReadMock: vi.fn<(input: { id: string }) => Promise<void>>(async () => undefined),
  pushMock: vi.fn<(area: string, href: string, state: unknown) => Promise<void>>(
    async () => undefined
  ),
  requestActivateServerSessionMock: vi.fn<(serverSessionId: string) => boolean>(() => true),
  useNavLayoutMock: vi.fn(),
}))

let currentNotifications: NotificationRecord[] = []
let currentConfig: OpenSpecUIConfig = DEFAULT_CONFIG
let terminalArea: 'main' | 'bottom' | 'pop' = 'main'

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: (path: string) => (path === '/terminal' ? terminalArea : 'main'),
  },
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    hasServerSession: (serverSessionId: string) => hasServerSessionMock(serverSessionId),
    requestActivateServerSession: (serverSessionId: string) =>
      requestActivateServerSessionMock(serverSessionId),
  },
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    notifications: {
      markRead: { mutate: (input: { id: string }) => markReadMock(input) },
      markManyRead: { mutate: vi.fn() },
      clearGroup: { mutate: vi.fn() },
      clearAll: { mutate: vi.fn() },
      clearTerminalSession: { mutate: vi.fn() },
    },
    config: {
      update: { mutate: vi.fn() },
    },
  },
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => useNavLayoutMock(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({ data: currentConfig }),
  useNotificationsSubscription: () => ({ data: currentNotifications }),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: {
    activateBottom: (href: string) => activateBottomMock(href),
    activatePop: vi.fn(),
    deactivatePop: () => deactivatePopMock(),
    push: (area: string, href: string, state: unknown) => pushMock(area, href, state),
  },
}))

vi.mock('./sound-engine', () => ({
  NotificationSoundEngine: class {
    init(): void {
      // noop
    }

    play(): Promise<void> {
      return Promise.resolve()
    }
  },
}))

function createTerminalNotification(
  action: NotificationAction = {
    type: 'terminal.focus',
    label: 'Focus terminal',
    target: { sessionId: 'pty-1' },
  }
): NotificationRecord {
  return {
    id: 'notification-1',
    title: 'Terminal zsh has an event',
    body: '',
    source: { type: 'terminal', sessionId: 'pty-1', title: 'zsh' },
    actions: [action],
    level: 'info',
    createdAt: 100,
    groupKey: 'terminal:pty-1',
  }
}

function ActionHarness() {
  const notification = currentNotifications[0]
  const { resolveAction } = useNotifications()
  if (!notification) return null
  const resolved = resolveAction(notification, notification.actions[0]!)
  return (
    <button type="button" disabled={resolved.disabled} onClick={() => void resolved.run()}>
      {resolved.disabled ? resolved.reason : resolved.action.label}
    </button>
  )
}

describe('NotificationProvider action resolution', () => {
  afterEach(() => {
    cleanup()
    activateBottomMock.mockClear()
    deactivatePopMock.mockClear()
    hasServerSessionMock.mockReset()
    hasServerSessionMock.mockReturnValue(true)
    markReadMock.mockClear()
    pushMock.mockClear()
    requestActivateServerSessionMock.mockReset()
    requestActivateServerSessionMock.mockReturnValue(true)
    terminalArea = 'main'
    currentNotifications = []
    currentConfig = DEFAULT_CONFIG
    vi.unstubAllGlobals()
  })

  it('closes notifications, reveals the main terminal panel, and requests terminal activation', async () => {
    currentNotifications = [createTerminalNotification()]
    useNavLayoutMock.mockReturnValue({
      popActive: true,
      popLocation: { pathname: '/notifications', search: '' },
    })

    render(
      <NotificationProvider>
        <ActionHarness />
      </NotificationProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Focus terminal' }))

    await waitFor(() => {
      expect(deactivatePopMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledWith('main', '/terminal', null)
      expect(requestActivateServerSessionMock).toHaveBeenCalledWith('pty-1')
      expect(markReadMock).toHaveBeenCalledWith({ id: 'notification-1' })
    })
    expect(activateBottomMock).not.toHaveBeenCalled()
  })

  it('reveals bottom terminal panels before requesting terminal activation', async () => {
    terminalArea = 'bottom'
    currentNotifications = [createTerminalNotification()]
    useNavLayoutMock.mockReturnValue({
      popActive: true,
      popLocation: { pathname: '/notifications', search: '' },
    })

    render(
      <NotificationProvider>
        <ActionHarness />
      </NotificationProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Focus terminal' }))

    await waitFor(() => {
      expect(deactivatePopMock).toHaveBeenCalledTimes(1)
      expect(activateBottomMock).toHaveBeenCalledWith('/terminal')
      expect(requestActivateServerSessionMock).toHaveBeenCalledWith('pty-1')
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('disables terminal focus actions when the target terminal is gone', () => {
    currentNotifications = [createTerminalNotification()]
    hasServerSessionMock.mockReturnValue(false)
    useNavLayoutMock.mockReturnValue({
      popActive: true,
      popLocation: { pathname: '/notifications', search: '' },
    })

    render(
      <NotificationProvider>
        <ActionHarness />
      </NotificationProvider>
    )

    expect(
      screen.getByRole('button', { name: 'Target terminal is no longer available.' })
    ).toBeDisabled()
  })

  it('mirrors the latest message content and unread metadata to browser notifications', async () => {
    const createdNotifications: Array<{
      title: string
      options?: NotificationOptions
      close: () => void
    }> = []
    class MockBrowserNotification {
      static permission: NotificationPermission = 'granted'

      onclick: (() => void) | null = null

      constructor(title: string, options?: NotificationOptions) {
        createdNotifications.push({
          title,
          options,
          close: () => undefined,
        })
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('Notification', MockBrowserNotification)
    currentConfig = {
      ...DEFAULT_CONFIG,
      notifications: {
        ...DEFAULT_CONFIG.notifications,
        systemNotificationsEnabled: true,
      },
    }
    currentNotifications = [
      createTerminalNotification({
        type: 'terminal.focus',
        label: 'Focus terminal',
        target: { sessionId: 'pty-1' },
      }),
      {
        ...createTerminalNotification(),
        id: 'notification-2',
        createdAt: 90,
      },
    ].map((notification, index) =>
      index === 0
        ? {
            ...notification,
            body: 'Allow Web Search',
          }
        : notification
    )
    useNavLayoutMock.mockReturnValue({
      popActive: false,
      popLocation: { pathname: '/', search: '' },
    })

    render(
      <NotificationProvider>
        <div />
      </NotificationProvider>
    )

    await waitFor(() => {
      expect(createdNotifications).toHaveLength(1)
    })
    const expectedTime = new Date(100).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(createdNotifications[0]?.title).toBe('Allow Web Search')
    expect(createdNotifications[0]?.options).toMatchObject({
      body: `${expectedTime} - 2 unread notifications`,
      icon: 'http://localhost:3000/icon.rounded.svg',
      tag: 'openspecui-notifications',
    })
  })
})
