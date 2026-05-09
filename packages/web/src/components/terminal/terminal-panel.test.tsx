import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
} = vi.hoisted(() => ({
  useTerminalContextMock: vi.fn(),
  useNavLayoutMock: vi.fn(),
  tabsPropsSpy: vi.fn(),
  getResolvedThemeMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  subscribeMock: vi.fn<() => typeof noopUnsubscribe>(() => noopUnsubscribe),
  setInputPanelMountTargetMock: vi.fn(),
  setInputPanelDefaultLayoutMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => useTerminalContextMock(),
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => useNavLayoutMock(),
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
    tabs: Array<{ id: string; content: ReactNode }>
  }) => {
    tabsPropsSpy(props)
    return (
      <div data-testid="tabs">
        {props.actions}
        {props.tabs.map((tab) => (
          <div key={tab.id}>{tab.content}</div>
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

describe('TerminalPanel', () => {
  beforeEach(() => {
    tabsPropsSpy.mockReset()
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'shell-1',
          displayTitle: 'shell-1',
          isExited: false,
          exitCode: null,
          outputActive: false,
        },
      ],
      activeSessionId: 'shell-1',
      setActiveSession: vi.fn(),
      createSession: vi.fn(),
      closeSession: vi.fn(),
      setCustomTitle: vi.fn(),
    })
    useNavLayoutMock.mockReturnValue({
      bottomTabs: ['/terminal'],
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

  it('renders terminal tabs with resolved theme css vars', () => {
    const { getByTestId } = render(<TerminalPanel />)

    expect(tabsPropsSpy).toHaveBeenCalledTimes(1)

    const tabs = getByTestId('tabs')
    const wrapper = tabs.parentElement
    expect(wrapper?.style.getPropertyValue('--terminal')).toBe('#fdf6e3')
    expect(wrapper?.style.getPropertyValue('--terminal-foreground')).toBe('#586e75')
  })
})
