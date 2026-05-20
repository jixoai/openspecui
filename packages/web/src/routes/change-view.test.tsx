import { cleanup, render, screen } from '@testing-library/react'
import { createContext, type ComponentProps, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeView } from './change-view'

const statusMock = vi.hoisted(() => vi.fn())
const changeFilesMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusSubscription: statusMock,
}))

vi.mock('@/lib/use-subscription', () => ({
  useChangeFilesSubscription: changeFilesMock,
}))

vi.mock('@/components/folder-editor-viewer', () => ({
  FolderEditorViewer: () => <div>folder</div>,
}))

vi.mock('@/components/opsx/artifact-output-viewer', () => ({
  ArtifactOutputViewer: ({ artifact }: { artifact: { id: string } }) => (
    <div>artifact:{artifact.id}</div>
  ),
  ContentFallbackViewer: ({ fallback }: { fallback: { label?: string } }) => (
    <div>fallback:{fallback.label ?? 'Content'}</div>
  ),
}))

vi.mock('@/components/opsx/change-command-bar', () => ({
  ChangeCommandBar: () => <div>commands</div>,
}))

vi.mock('@/components/tabs', () => ({
  Tabs: ({
    tabs,
    selectedTab,
  }: {
    tabs: Array<{ id: string; label?: ReactNode; content: ReactNode }>
    selectedTab?: string
  }) => (
    <div>
      <nav>
        {tabs.map((tab) => (
          <button key={tab.id} type="button">
            {tab.label}
          </button>
        ))}
      </nav>
      <div>{tabs.find((tab) => tab.id === selectedTab)?.content ?? tabs[0]?.content}</div>
    </div>
  ),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  vtNavController: { activatePop: vi.fn() },
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
  readSharedElementHandoffState: () => null,
}))

vi.mock('@/lib/view-transitions/tabs', () => ({
  useRoutedCarouselTabs: ({ initialTab }: { initialTab?: string }) => ({
    tabsRef: { current: null },
    selectedTab: initialTab,
    onTabChange: vi.fn(),
  }),
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
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    statusMock.mockReset()
    changeFilesMock.mockReset()
    changeFilesMock.mockReturnValue({
      data: [{ path: 'notes/decision.md', type: 'file', content: '# Decision' }],
      isLoading: false,
      error: null,
    })
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

  it('renders change artifacts, folder, and toolbar through the shared detail view', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: false,
        applyRequires: [],
        artifacts: [
          { id: 'intake', outputPath: 'intake.md', status: 'done' },
          { id: 'implementation', outputPath: 'implementation.md', status: 'ready' },
        ],
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
    expect(screen.getByText('Schema: opsx-collab-pr-loop · 1/2 artifacts')).toBeTruthy()
    expect(screen.getByText('commands')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'intake' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'implementation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(screen.getByText('artifact:implementation')).toBeTruthy()
  })

  it('falls back to the shared content document tab when no artifact tab is available', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: false,
        applyRequires: [],
        artifacts: [],
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByRole('button', { name: 'Content' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(screen.getByText('fallback:Content')).toBeTruthy()
  })
})
