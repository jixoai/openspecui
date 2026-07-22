/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Verify change detail fallbacks and schema-driven artifact rendering.
 * 2. Verify retained status errors alongside detail and Root Context failure locks the workflow toolbar.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Review request (2026-07-23): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createContext, type ComponentProps, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeView } from './change-view'

const statusMock = vi.hoisted(() => vi.fn())
const applyInstructionsMock = vi.hoisted(() => vi.fn())
const changeFilesMock = vi.hoisted(() => vi.fn())
const rootActionMock = vi.hoisted(() => vi.fn())
const openArchiveModalMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-opsx', () => ({
  useOpsxApplyInstructionsSubscription: applyInstructionsMock,
  useOpsxStatusSubscription: statusMock,
}))

vi.mock('@/lib/use-subscription', () => ({
  useChangeFilesSubscription: changeFilesMock,
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
}))

vi.mock('@/lib/archive-modal-context', () => ({
  useArchiveModal: () => ({ openArchiveModal: openArchiveModalMock }),
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
    applyInstructionsMock.mockReset().mockReturnValue({ data: undefined })
    changeFilesMock.mockReset()
    rootActionMock.mockReset().mockReturnValue({
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    openArchiveModalMock.mockReset()
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

  it('keeps retained change detail visible beside a terminal status error', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: false,
        applyRequires: [],
        artifacts: [{ id: 'implementation', outputPath: 'implementation.md', status: 'ready' }],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: new Error('status transport failed'),
    })

    render(<ChangeView />)

    expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
    expect(screen.getByText('artifact:implementation')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error loading change: status transport failed'
    )
  })

  it('shows the existing raw error state when status is unavailable', () => {
    statusMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('status transport failed'),
    })

    render(<ChangeView />)

    expect(screen.getByText('Error loading change: status transport failed')).toBeTruthy()
    expect(screen.queryByText('Loading change status...')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull()
  })

  it('keeps the initial loading state when status has not arrived', () => {
    statusMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByText('Loading change status...')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
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
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
    expect(screen.getByText('Schema: opsx-collab-pr-loop · 1/2 artifacts')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'intake' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'implementation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(screen.getByText('artifact:implementation')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(openArchiveModalMock).toHaveBeenCalledWith(
      'extract-terminal-view-webcomponent',
      'Extract Terminal View Webcomponent'
    )
  })

  it('shows attributed Apply and tracked counts when upstream projections diverge', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: false,
        applyRequires: [],
        artifacts: [{ id: 'implementation', outputPath: 'implementation.md', status: 'ready' }],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })
    applyInstructionsMock.mockReturnValue({
      data: {
        applyInstructionProgress: {
          source: 'openspec-instructions-apply',
          total: 0,
          complete: 0,
          remaining: 0,
          state: 'all_done',
          divergence: {
            kind: 'tracked-task-mismatch',
            message: 'different',
            apply: { total: 0, complete: 0, remaining: 0 },
            tracked: { total: 3, completed: 1, remaining: 2, phase: 'in-progress' },
          },
        },
      },
    })

    render(<ChangeView />)

    expect(screen.getByText('Apply instructions: 0/0')).toBeTruthy()
    expect(screen.getByText('Tracked artifact glob: 1/3')).toBeTruthy()
  })

  it('falls back to the shared content document tab when no artifact tab is available', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: false,
        applyRequires: [],
        artifacts: [],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByRole('button', { name: 'Content' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(screen.getByText('fallback:Content')).toBeTruthy()
  })

  it('locks every change action while Root Context is unavailable', () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root selection failed.',
      evidence: ['Doctor exit: 1'],
    })
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isComplete: true,
        applyRequires: [],
        artifacts: [{ id: 'implementation', outputPath: 'implementation.md', status: 'done' }],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    for (const name of [
      'Continue',
      'Fast-forward',
      'Apply',
      'Update',
      'Sync',
      'Archive',
      'Verify',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByRole('alert')).toHaveTextContent('Doctor exit: 1')
  })
})
