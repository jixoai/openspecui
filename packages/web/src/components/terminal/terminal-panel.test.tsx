import type { NotificationRecord } from '@openspecui/core/notifications'
import { fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalPanel } from './terminal-panel'

const noopUnsubscribe = () => {}

const {
  useTerminalContextMock,
  useNavLayoutMock,
  tabsPropsSpy,
  getResolvedThemeMock,
  getSnapshotMock,
  subscribeMock,
  setInputPanelMountTargetMock,
  setInputPanelDefaultLayoutMock,
  useTerminalInvocationConfigMock,
  createShellSessionMock,
  clearTerminalSessionMock,
  useNotificationsMock,
} = vi.hoisted(() => ({
  useTerminalContextMock: vi.fn(),
  useNavLayoutMock: vi.fn(),
  tabsPropsSpy: vi.fn(),
  getResolvedThemeMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  subscribeMock: vi.fn<() => typeof noopUnsubscribe>(() => noopUnsubscribe),
  setInputPanelMountTargetMock: vi.fn(),
  setInputPanelDefaultLayoutMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
  createShellSessionMock: vi.fn(),
  clearTerminalSessionMock: vi.fn(async () => undefined),
  useNotificationsMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => useTerminalContextMock(),
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => useNavLayoutMock(),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    moveTab: vi.fn(),
    closeTab: vi.fn(),
  },
}))

vi.mock('./terminal-tabs', () => ({
  TerminalTabs: (props: {
    actions?: ReactNode
    tabs: Array<{
      id: string
      title?: string
      label: ReactNode
      badge?: ReactNode
      content: ReactNode
    }>
    onTabChange?: (id: string) => void
  }) => {
    tabsPropsSpy(props)
    return (
      <div data-testid="tabs">
        {props.actions}
        {props.tabs.map((tab) => (
          <button key={tab.id} type="button" data-tab-id={tab.id} title={tab.title}>
            {tab.badge && (
              <span data-tabs-badge="true" className="absolute right-1 top-1">
                {tab.badge}
              </span>
            )}
            {tab.label}
            {tab.content}
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock('./xterm-terminal', () => ({
  XtermTerminal: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`xterm-${sessionId}`} />
  ),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    subscribe: () => subscribeMock(),
    getSnapshot: () => getSnapshotMock(),
    getResolvedTheme: () => getResolvedThemeMock(),
    setInputPanelMountTarget: (target: HTMLElement | null) => setInputPanelMountTargetMock(target),
    setInputPanelDefaultLayout: (layout: 'floating' | 'fixed') =>
      setInputPanelDefaultLayoutMock(layout),
    openInputPanel: vi.fn(),
  },
}))

vi.mock('@/lib/notifications/context', () => ({
  useNotifications: () => useNotificationsMock(),
}))

function createTerminalNotification(
  id: string,
  sessionId: string,
  createdAt: number
): NotificationRecord {
  return {
    id,
    title: 'Claude Code',
    body: 'Claude needs your permission to use Bash',
    source: { type: 'terminal', sessionId, title: 'Claude Code' },
    actions: [
      {
        type: 'terminal.focus',
        label: 'Focus terminal',
        target: { sessionId },
      },
    ],
    level: 'info',
    createdAt,
    groupKey: `terminal:${sessionId}`,
  }
}

describe('TerminalPanel', () => {
  beforeEach(() => {
    tabsPropsSpy.mockReset()
    clearTerminalSessionMock.mockClear()
    useNotificationsMock.mockReturnValue({
      notifications: [],
      clearTerminalSession: clearTerminalSessionMock,
    })
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'shell-1',
          serverSessionId: 'pty-1',
          displayTitle: 'shell-1',
          isExited: false,
          exitCode: null,
          outputActive: false,
          lastBellAt: null,
        },
      ],
      activeSessionId: 'shell-1',
      setActiveSession: vi.fn(),
      createShellSession: createShellSessionMock,
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })
    createShellSessionMock.mockReset()
    useTerminalInvocationConfigMock.mockReturnValue({
      shellProfiles: [
        {
          id: 'builtin:sh',
          label: '/bin/sh',
          command: '/bin/sh',
          args: [],
          source: 'builtin',
          quoteStyle: 'posix',
        },
      ],
      spawnCommands: [
        {
          id: 'builtin:claude',
          label: 'Claude',
          command: 'claude',
          args: [
            {
              kind: 'booleanFlag',
              fieldId: 'dangerouslySkipPermissions',
              flag: '--dangerously-skip-permissions',
            },
          ],
          fields: [
            {
              id: 'dangerouslySkipPermissions',
              label: 'Skip permissions',
              type: 'boolean',
              options: [],
              defaultValue: false,
              required: false,
              advanced: true,
            },
          ],
          source: 'builtin',
        },
      ],
      defaultShellProfile: {
        id: 'builtin:sh',
        label: '/bin/sh',
        command: '/bin/sh',
        args: [],
        source: 'builtin',
        quoteStyle: 'posix',
      },
    })
    useNavLayoutMock.mockReturnValue({
      bottomTabs: ['/terminal'],
      mainLocation: { pathname: '/dashboard' },
      bottomLocation: { pathname: '/terminal' },
    })
    getSnapshotMock.mockReturnValue({ sessions: [] })
    getResolvedThemeMock.mockReturnValue({
      definition: {
        palette: {
          background: '#fdf6e3',
          foreground: '#586e75',
        },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders terminal tabs with resolved theme css vars', () => {
    const { getByTestId } = render(<TerminalPanel />)

    expect(tabsPropsSpy).toHaveBeenCalledTimes(1)

    const tabs = getByTestId('tabs')
    const wrapper = tabs.parentElement
    expect(wrapper?.style.getPropertyValue('--terminal')).toBe('#fdf6e3')
    expect(wrapper?.style.getPropertyValue('--terminal-foreground')).toBe('#586e75')
  })

  it('renders primary ripple feedback when a session bell fires', () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'shell-1',
          serverSessionId: 'pty-1',
          displayTitle: 'shell-1',
          isExited: false,
          exitCode: null,
          outputActive: false,
          lastBellAt: 1234,
        },
      ],
      activeSessionId: 'shell-1',
      setActiveSession: vi.fn(),
      createShellSession: createShellSessionMock,
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })

    const { getByTestId } = render(<TerminalPanel />)

    expect(getByTestId('terminal-bell-ripple-shell-1').className).toContain(
      'animate-terminal-bell-ripple'
    )
  })

  it('creates the default shell when clicking the terminal add button', () => {
    const { getAllByTitle } = render(<TerminalPanel />)

    fireEvent.click(getAllByTitle('New terminal')[0]!)

    expect(createShellSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'builtin:sh', command: '/bin/sh' })
    )
  })

  it('creates the default shell from the empty terminal state', () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [],
      activeSessionId: null,
      setActiveSession: vi.fn(),
      createShellSession: createShellSessionMock,
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })

    const { getByText } = render(<TerminalPanel />)

    fireEvent.click(getByText('+'))

    expect(createShellSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'builtin:sh', command: '/bin/sh' })
    )
  })

  it('opens shell and command creation choices from the terminal options button', () => {
    const { getAllByTitle, getByText } = render(<TerminalPanel />)

    fireEvent.click(getAllByTitle('New terminal options')[0]!)

    expect(getByText('/bin/sh')).toBeTruthy()
    expect(getByText('Claude')).toBeTruthy()
  })

  it('renders a dot-only unread badge for a single terminal notification', () => {
    useNotificationsMock.mockReturnValue({
      notifications: [createTerminalNotification('n-1', 'pty-1', 100)],
      clearTerminalSession: clearTerminalSessionMock,
    })

    const { getByLabelText, queryByText } = render(<TerminalPanel />)

    const badge = getByLabelText('1 unread notification')
    expect(badge.closest('[data-tabs-badge="true"]')).toBeTruthy()
    expect(queryByText('1')).toBeNull()
  })

  it('renders an absolute numeric badge for multiple terminal notifications', () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        createTerminalNotification('n-2', 'pty-1', 200),
        createTerminalNotification('n-1', 'pty-1', 100),
      ],
      clearTerminalSession: clearTerminalSessionMock,
    })

    const { getByLabelText, getByText } = render(<TerminalPanel />)

    const badge = getByLabelText('2 unread notifications')
    expect(badge.closest('[data-tabs-badge="true"]')).toBeTruthy()
    expect(getByText('2')).toBeTruthy()
  })

  it('binds the full terminal title to the tab trigger title attribute', () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'shell-1',
          serverSessionId: 'pty-1',
          displayTitle: 'Claude Code - very long terminal title',
          isExited: false,
          exitCode: null,
          outputActive: false,
          lastBellAt: null,
        },
      ],
      activeSessionId: 'shell-1',
      setActiveSession: vi.fn(),
      createShellSession: createShellSessionMock,
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })

    const { getByTitle } = render(<TerminalPanel />)

    expect(getByTitle('Claude Code - very long terminal title')).toBeTruthy()
    const props = tabsPropsSpy.mock.calls.at(-1)?.[0] as
      | { tabs: Array<{ id: string; title?: string }> }
      | undefined
    expect(props?.tabs[0]?.title).toBe('Claude Code - very long terminal title')
  })

  it('auto-consumes focused terminal notifications after a short delay', () => {
    vi.useFakeTimers()
    useNotificationsMock.mockReturnValue({
      notifications: [createTerminalNotification('n-1', 'pty-1', 100)],
      clearTerminalSession: clearTerminalSessionMock,
    })

    render(<TerminalPanel />)

    expect(clearTerminalSessionMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1999)
    expect(clearTerminalSessionMock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(clearTerminalSessionMock).toHaveBeenCalledWith('pty-1')
  })

  it('does not auto-consume terminal notifications while the terminal panel is hidden', () => {
    vi.useFakeTimers()
    useNavLayoutMock.mockReturnValue({
      bottomTabs: ['/terminal'],
      mainLocation: { pathname: '/dashboard' },
      bottomLocation: { pathname: '/' },
    })
    useNotificationsMock.mockReturnValue({
      notifications: [createTerminalNotification('n-1', 'pty-1', 100)],
      clearTerminalSession: clearTerminalSessionMock,
    })

    render(<TerminalPanel />)

    vi.advanceTimersByTime(2001)
    expect(clearTerminalSessionMock).not.toHaveBeenCalled()
  })

  it('clears terminal notifications immediately when switching to that terminal', () => {
    const setActiveSessionMock = vi.fn()
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'shell-1',
          serverSessionId: 'pty-1',
          displayTitle: 'shell-1',
          isExited: false,
          exitCode: null,
          outputActive: false,
          lastBellAt: null,
        },
        {
          id: 'shell-2',
          serverSessionId: 'pty-2',
          displayTitle: 'shell-2',
          isExited: false,
          exitCode: null,
          outputActive: false,
          lastBellAt: null,
        },
      ],
      activeSessionId: 'shell-1',
      setActiveSession: setActiveSessionMock,
      createShellSession: createShellSessionMock,
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })

    render(<TerminalPanel />)

    const props = tabsPropsSpy.mock.calls.at(-1)?.[0] as
      | { tabs: Array<{ id: string }>; onTabChange?: (id: string) => void }
      | undefined
    expect(props).toBeDefined()
    props?.onTabChange?.('shell-2')

    expect(setActiveSessionMock).toHaveBeenCalledWith('shell-2')
    expect(clearTerminalSessionMock).toHaveBeenCalledWith('pty-2')
  })
})
