import { render, screen } from '@testing-library/react'
import { createContext, type ComponentProps, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeView } from './change-view'

const statusMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusSubscription: statusMock,
}))

vi.mock('@/lib/use-tabs-status-by-query', () => ({
  useTabsStatusByQuery: () => ({ selectedTab: undefined, setSelectedTab: vi.fn() }),
}))

vi.mock('@/components/folder-editor-viewer', () => ({
  FolderEditorViewer: () => <div>folder</div>,
}))

vi.mock('@/components/opsx/artifact-output-viewer', () => ({
  ArtifactOutputViewer: () => <div>artifact</div>,
}))

vi.mock('@/components/opsx/change-command-bar', () => ({
  ChangeCommandBar: () => <div>commands</div>,
}))

vi.mock('@/components/tabs', () => ({
  Tabs: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: { activatePop: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({
    pathname: '/changes/extract-terminal-view-webcomponent',
    search: '',
    hash: '',
    state: null,
  }),
  useNavigate: () => vi.fn(),
  getRouterContext: () => createContext(null),
  useParams: () => ({ changeId: 'extract-terminal-view-webcomponent' }),
}))

describe('ChangeView', () => {
  beforeEach(() => {
    statusMock.mockReset()
  })

  it('shows a friendly fallback for missing changes', () => {
    statusMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error(
        "Change 'extract-terminal-view-webcomponent' not found. Available changes: compact-chat-density-and-layout-rubric"
      ),
    })

    render(<ChangeView />)

    expect(screen.getByText('Change not found in the current project.')).toBeTruthy()
    expect(screen.queryByText(/Error loading change:/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Changes' }).getAttribute('href')).toBe(
      '/changes'
    )
  })
})
