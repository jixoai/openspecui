import {
  NotificationContextProvider,
  type NotificationContextValue,
} from '@/lib/notifications/context'
import {
  groupNotifications,
  type NotificationAction,
  type NotificationRecord,
} from '@openspecui/core/notifications'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { isValidElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationsPanel } from './notifications-panel'

const setConfigMock = vi.fn()
const markManyReadMock = vi.fn(async (_ids: readonly string[]) => {})

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({
    setConfig: setConfigMock,
  }),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    hasServerSession: () => true,
    requestActivateServerSession: () => true,
  },
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: () => 'main',
  },
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    notifications: {
      markRead: { mutate: vi.fn() },
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
  useNavLayout: () => ({
    popActive: true,
    popLocation: { pathname: '/notifications', search: '' },
  }),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({ data: undefined }),
  useNotificationsSubscription: () => ({ data: [] }),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: {
    activatePop: vi.fn(),
    deactivatePop: vi.fn(),
    push: vi.fn(),
    activateBottom: vi.fn(),
  },
}))

function record(input: {
  id: string
  title: string
  createdAt: number
  body?: string
  actions?: NotificationAction[]
}): NotificationRecord {
  const source = { type: 'terminal' as const, sessionId: 'pty-1', title: 'zsh' }
  return {
    id: input.id,
    title: input.title,
    body: input.body ?? '',
    source,
    actions: input.actions ?? [
      {
        type: 'terminal.focus',
        label: 'Focus terminal',
        target: { sessionId: 'pty-1' },
      },
    ],
    level: 'info',
    createdAt: input.createdAt,
    groupKey: 'terminal:pty-1',
  }
}

function renderPanel(notifications: NotificationRecord[]) {
  const context: NotificationContextValue = {
    notifications,
    latestNotification: notifications[0] ?? null,
    groups: groupNotifications(notifications),
    unreadCount: notifications.length,
    highlightedId: null,
    browserSupported: false,
    browserPermission: 'unsupported',
    panelOpen: true,
    openPanel: () => undefined,
    requestBrowserPermission: async () => 'unsupported',
    previewSound: async () => undefined,
    resolveAction: (_notification, action) => ({
      action,
      disabled: false,
      run: async () => undefined,
    }),
    markRead: async () => undefined,
    markManyRead: markManyReadMock,
    clearGroup: async () => undefined,
    clearAll: async () => undefined,
    clearTerminalSession: async () => undefined,
  }

  return render(
    <NotificationContextProvider value={context}>
      <NotificationsPanel />
    </NotificationContextProvider>
  )
}

describe('NotificationsPanel', () => {
  afterEach(() => {
    cleanup()
    setConfigMock.mockClear()
    markManyReadMock.mockClear()
  })

  it('renders identical instance notifications as one aggregate with a count', () => {
    const { getByLabelText, getAllByText } = renderPanel([
      record({ id: 'n1', title: 'Terminal zsh has an event', createdAt: 100 }),
      record({ id: 'n2', title: 'Terminal zsh has an event', createdAt: 200 }),
      record({ id: 'n3', title: 'Terminal zsh has an event', createdAt: 300 }),
    ])

    const count = getByLabelText('3 identical notifications')
    expect(count.getAttribute('data-ui-badge')).toBe('true')
    expect(within(count).getByText('3')).toBeTruthy()
    expect(getAllByText('Terminal zsh has an event')).toHaveLength(1)
  })

  it('marks every notification in an aggregate as read', () => {
    const { getByRole } = renderPanel([
      record({ id: 'n1', title: 'Terminal zsh has an event', createdAt: 100 }),
      record({ id: 'n2', title: 'Terminal zsh has an event', createdAt: 200 }),
      record({ id: 'n3', title: 'Terminal zsh has an event', createdAt: 300 }),
    ])

    fireEvent.click(getByRole('button', { name: 'Read' }))

    expect(markManyReadMock).toHaveBeenCalledWith(['n3', 'n2', 'n1'])
  })

  it('renders notification action buttons with the primary button style', () => {
    renderPanel([record({ id: 'n1', title: 'Terminal zsh has an event', createdAt: 100 })])

    const config = setConfigMock.mock.calls.at(-1)?.[0] as { headerActions?: unknown } | undefined
    if (!isValidElement<{ className?: string }>(config?.headerActions)) {
      throw new Error('Expected NotificationsPanel to configure header actions.')
    }
    expect(config.headerActions.props.className).toContain('bg-primary')

    const focusButton = screen.getByRole('button', { name: 'Focus terminal' })
    expect(focusButton.className).toContain('bg-primary')
    const readButton = screen.getByRole('button', { name: 'Read' })
    expect(readButton.className).toContain('bg-primary')
  })

  it('uses a grid-row container for collapsed group content', () => {
    const { getByRole, container } = renderPanel([
      record({ id: 'n1', title: 'Terminal zsh has an event', createdAt: 100 }),
      record({ id: 'n2', title: 'Deploy finished', createdAt: 200 }),
    ])

    fireEvent.click(getByRole('button', { name: 'Collapse group' }))

    expect(container.querySelector('.grid-rows-\\[0fr\\]')).toBeTruthy()
  })
})
