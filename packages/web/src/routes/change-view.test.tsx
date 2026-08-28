/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Verify change detail fallbacks and schema-driven artifact rendering.
 * 2. Verify retained errors and non-current authority lock actions without entering the Header.
 * 3. Verify Apply inputs remain separate and open from a Header Action Dialog.
 * 4. Verify active Change alone owns the routed Evidence tab and explicit unavailable facts.
 * 5. Verify the Evidence tab renders the container-responsive list-detail workspace with
 *    keyboard-reachable rows, crowded drill/back, and unfabricated row chips.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Review request (2026-07-23): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Original request (2026-07-28): keep progress divergence direct while compressing its source counts.
 * Original request (2026-08-03): move complete Change evidence into a dedicated tab page.
 * Owner correction (2026-08-03): move Actions inline with the title, unify subtitle badges, and localize unavailable Tooltips.
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 */
import type { RootActionState } from '@/lib/use-root-action-state'
import type { ChangeStatus } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createContext, type ComponentProps, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeView } from './change-view'

const statusMock = vi.hoisted(() => vi.fn())
const applyInstructionsMock = vi.hoisted(() => vi.fn())
const changeFilesMock = vi.hoisted(() => vi.fn())
const rootActionMock = vi.hoisted(() => vi.fn())
const openArchiveModalMock = vi.hoisted(() => vi.fn())
const isStaticModeMock = vi.hoisted(() => vi.fn(() => false))
const routedTabState = vi.hoisted(() => ({ selectedTab: undefined as string | undefined }))

const diffEvidenceQueryMock = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => Promise.reject(new Error('not under test')))
)

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    change: {
      diffEvidence: {
        query: (...args: unknown[]) => diffEvidenceQueryMock(...args),
      },
    },
  },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => isStaticModeMock(),
}))

const rootActionFailureCases: Array<Extract<RootActionState, { status: 'blocked' | 'checking' }>> =
  [
    {
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root selection failed.',
      evidence: ['Doctor exit: 1'],
    },
    {
      status: 'checking',
      disabled: true,
      context: null,
      observedAt: 3,
      title: 'Checking planning root',
      message: 'Refreshing root selection.',
      evidence: [],
    },
  ]

const retainedChangeStatus = {
  changeName: 'Extract Terminal View Webcomponent',
  schemaName: 'opsx-collab-pr-loop',
  isPlanningComplete: false,
  applyRequires: [],
  artifacts: [
    { id: 'implementation', outputPath: 'implementation.md', status: 'ready', requires: [] },
  ],
  provenance: { kind: 'static' },
} satisfies ChangeStatus

const liveCliChangeStatus = {
  changeName: 'Extract Terminal View Webcomponent',
  schemaName: 'opsx-collab-pr-loop',
  isPlanningComplete: false,
  applyRequires: [],
  artifacts: [
    { id: 'implementation', outputPath: 'implementation.md', status: 'ready', requires: [] },
  ],
  provenance: {
    kind: 'cli',
    planningHome: {
      kind: 'repo',
      root: '/planning',
      changesDir: '/planning/openspec/changes',
      defaultSchema: 'opsx-collab-pr-loop',
    },
    changeRoot: '/planning/openspec/changes/extract-terminal-view-webcomponent',
    artifactPaths: {
      implementation: {
        outputPath: 'implementation.md',
        resolvedOutputPath:
          '/planning/openspec/changes/extract-terminal-view-webcomponent/implementation.md',
        existingOutputPaths: [],
      },
    },
    nextSteps: ['Apply the change.'],
    actionContext: {
      mode: 'repo-local',
      sourceOfTruth: 'repo',
      planningArtifacts: ['implementation'],
      linkedContext: [],
      allowedEditRoots: ['/planning'],
      requiresAffectedAreaSelection: false,
      constraints: [],
    },
    root: { path: '/planning', source: 'nearest' },
    evidence: {
      command: 'status',
      success: true,
      stdout: '{"changeName":"extract-terminal-view-webcomponent"}',
      stderr: '',
      exitCode: 0,
      payload: { changeName: 'extract-terminal-view-webcomponent' },
      diagnostics: [],
      selector: {},
    },
  },
} satisfies ChangeStatus

/**
 * jsdom ships no layout engine, so the workspace's spacious topology state is driven through
 * the same ResizeObserver seam the production Git list-detail layout uses: a stubbed observer
 * reports one synthetic content width per observe() call.
 */
function stubEvidenceResizeObserver(width: number) {
  class MockResizeObserver {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      const element = target as HTMLElement
      this.callback(
        [
          {
            contentRect: {
              width,
              height: element.clientHeight || 320,
            } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      )
    }

    disconnect() {}
    unobserve() {}
  }

  vi.stubGlobal('ResizeObserver', MockResizeObserver)
}

vi.mock('@/lib/use-opsx', () => ({
  useOpsxApplyInstructionsSubscription: applyInstructionsMock,
  useOpsxStatusSubscription: (...args: unknown[]) => {
    const state = statusMock(...args)
    return {
      authority: state.error ? { state: 'failed', error: state.error } : { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
      ...state,
    }
  },
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
    selectedTab: routedTabState.selectedTab ?? initialTab,
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
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    statusMock.mockReset()
    applyInstructionsMock.mockReset().mockReturnValue({ data: undefined })
    changeFilesMock.mockReset()
    isStaticModeMock.mockReset().mockReturnValue(false)
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
    routedTabState.selectedTab = undefined
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

  it('keeps retained change detail visible beside a subscription error', () => {
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: new Error('status transport failed'),
    })

    render(<ChangeView />)

    expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
    expect(screen.getByText('artifact:implementation')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error loading change: status transport failed'
    )
  })

  it('keeps non-current Status authority and its action lock directly visible', () => {
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
      authority: { state: 'waiting' },
    })

    render(<ChangeView />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Change status is refreshing; actions remain read-only.'
    )
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
  })

  it('keeps Root and Status authority locks independently visible', () => {
    rootActionMock.mockReturnValue({
      status: 'checking',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Refreshing planning root',
      message: 'Root-dependent actions remain locked while OpenSpec refreshes root selection.',
      evidence: [],
    })
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
      authority: { state: 'waiting' },
    })

    render(<ChangeView />)

    const statuses = screen.getAllByRole('status')
    expect(
      statuses.some((status) =>
        status.textContent?.includes('Change status is refreshing; actions remain read-only.')
      )
    ).toBe(true)
    expect(
      statuses.some((status) =>
        status.textContent?.includes(
          'Root-dependent actions remain locked while OpenSpec refreshes root selection.'
        )
      )
    ).toBe(true)
  })

  it.each(rootActionFailureCases)(
    'keeps retained detail and error evidence while Root Context is $status',
    (rootAction) => {
      rootActionMock.mockReturnValue(rootAction)
      statusMock.mockReturnValue({
        data: retainedChangeStatus,
        isLoading: false,
        error: new Error('status transport failed'),
      })

      render(<ChangeView />)

      expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
      expect(screen.getByText('artifact:implementation')).toBeTruthy()
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((alert) => alert.textContent?.includes('status transport failed'))).toBe(
        true
      )
      if (rootAction.status === 'checking') {
        const statuses = screen.getAllByRole('status')
        expect(statuses.some((status) => status.textContent?.includes(rootAction.message))).toBe(
          true
        )
      } else {
        expect(
          alerts.some((alert) => alert.textContent?.includes(rootAction.evidence.join('\n')))
        ).toBe(true)
      }
      for (const name of ['Update', 'Archive', 'Verify']) {
        expect(screen.getByRole('button', { name })).toBeDisabled()
      }
    }
  )

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

  it('renders Actions and scan badges in the Header while keeping Evidence outside the default Artifact tab', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isPlanningComplete: false,
        applyRequires: [],
        artifacts: [
          { id: 'intake', outputPath: 'intake.md', status: 'done', requires: [] },
          {
            id: 'implementation',
            outputPath: 'implementation.md',
            status: 'ready',
            requires: ['intake'],
          },
        ],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByText('Extract Terminal View Webcomponent')).toBeTruthy()
    expect(
      screen.getByRole('note', { name: 'Workflow schema opsx-collab-pr-loop' })
    ).toHaveTextContent('Schema: opsx-collab-pr-loop')
    expect(screen.getByRole('note', { name: 'Artifact progress 1 of 2' })).toHaveTextContent(
      '1/2 artifacts'
    )
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'intake' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'implementation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Folder' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Evidence' })).toBeTruthy()
    expect(screen.getByText('artifact:implementation')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Change Evidence' })).toBeNull()
    const header = screen.getByTestId('opsx-detail-header')
    expect(header).toContainElement(screen.getByRole('button', { name: 'Update' }))
    expect(header).toContainElement(screen.getByText('References unavailable'))
    expect(screen.queryByTestId('opsx-detail-status-region')).toBeNull()

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
        isPlanningComplete: false,
        applyRequires: [],
        artifacts: [
          { id: 'implementation', outputPath: 'implementation.md', status: 'ready', requires: [] },
        ],
        provenance: { kind: 'static' },
      },
      isLoading: false,
      error: null,
    })
    applyInstructionsMock.mockReturnValue({
      data: {
        context: 'Preserve the project-specific deployment boundary.',
        operationGuidance: [
          'Implement tasks in order.',
          'Run focused verification before marking work complete.',
        ],
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

    // Under divergence the Apply count appears twice by design: once as the subtitle
    // badge (the progress authority) and once inside the direct divergence notice.
    expect(screen.getAllByRole('note', { name: 'Apply instructions progress 0 of 0' }).length).toBe(
      2
    )
    expect(screen.getByText('Upstream task progress divergence')).toBeVisible()
    expect(screen.getByRole('note', { name: 'Tracked artifact glob progress 1 of 3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply inputs' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Preserve the project-specific deployment boundary.')).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Apply inputs' }))
    expect(screen.getByRole('dialog', { name: 'Apply inputs' })).toBeVisible()
    expect(screen.getByText('Project context')).toBeVisible()
    expect(screen.getByText('Preserve the project-specific deployment boundary.')).toBeVisible()
    expect(screen.getByText('Operation guidance')).toBeVisible()
    expect(screen.getByText('Implement tasks in order.')).toBeVisible()
    expect(screen.getByText('Run focused verification before marking work complete.')).toBeVisible()
  })

  it('routes static Change evidence into its dedicated tab', () => {
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    expect(screen.getByRole('region', { name: 'Change Evidence' })).toHaveTextContent(
      'CLI Change context and Reference evidence are unavailable in this static snapshot.'
    )
    expect(screen.queryByText('artifact:implementation')).toBeNull()
  })

  it('replaces the stacked full-width accordions with a list-detail Evidence workspace', () => {
    routedTabState.selectedTab = 'evidence'
    isStaticModeMock.mockReturnValue(true)
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    expect(workspace.getAttribute('data-evidence-workspace')).not.toBeNull()
    // Rows preserve the decision-plane layer order; static snapshots publish no CLI-result row.
    const rows = Array.from(workspace.querySelectorAll<HTMLElement>('[data-evidence-row]'))
    expect(rows.map((row) => row.getAttribute('data-evidence-row'))).toEqual([
      'summary-paths',
      'requirement-diffs',
      'archived-validation',
    ])
    // The old stacked full-width accordion triggers are gone from the Evidence tab: the row
    // buttons carry no disclosure state, and the section titles now live in detail headings.
    expect(screen.queryByRole('button', { name: /Requirement diffs/, expanded: false })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Archived validation/, expanded: false })
    ).toBeNull()
    // Chips derive only from settled facts: static degradation names unavailable, and a row
    // without a fact (summary/paths) shows no chip at all.
    const diffRow = rows.find(
      (row) => row.getAttribute('data-evidence-row') === 'requirement-diffs'
    )
    expect(diffRow).not.toBeUndefined()
    if (diffRow) expect(within(diffRow).getByText('unavailable')).toBeTruthy()
    const validationRow = rows.find(
      (row) => row.getAttribute('data-evidence-row') === 'archived-validation'
    )
    expect(validationRow).not.toBeUndefined()
    if (validationRow) expect(within(validationRow).getByText('unavailable')).toBeTruthy()
    const summaryRow = rows.find((row) => row.getAttribute('data-evidence-row') === 'summary-paths')
    expect(summaryRow).not.toBeUndefined()
    if (summaryRow) expect(within(summaryRow).queryByText('unavailable')).toBeNull()
  })

  it('adds the CLI-result row in the layer order for live CLI provenance', () => {
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: liveCliChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    const rows = Array.from(workspace.querySelectorAll<HTMLElement>('[data-evidence-row]'))
    expect(rows.map((row) => row.getAttribute('data-evidence-row'))).toEqual([
      'summary-paths',
      'requirement-diffs',
      'archived-validation',
      'cli-result',
    ])
    fireEvent.click(within(workspace).getByRole('button', { name: /CLI result/ }))
    const detail = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    expect(detail).not.toBeNull()
    if (detail) {
      expect(within(detail).getByText('status')).toBeVisible()
      expect(within(detail).getByRole('button', { name: /Raw CLI payload/ })).toBeVisible()
    }
  })

  it('keeps every evidence row a natural keyboard-reachable button', () => {
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    const rows = Array.from(workspace.querySelectorAll<HTMLButtonElement>('[data-evidence-row]'))
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(row.tagName).toBe('BUTTON')
      expect(row.getAttribute('tabindex')).not.toBe('-1')
    }
    fireEvent.click(rows[2])
    const detail = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    expect(detail).not.toBeNull()
    if (detail) {
      expect(within(detail).getByRole('heading', { name: 'Archived validation' })).toBeVisible()
    }
  })

  it('drills from the crowded list into the detail and back without losing settled state', () => {
    routedTabState.selectedTab = 'evidence'
    isStaticModeMock.mockReturnValue(true)
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    // jsdom has no ResizeObserver, so the workspace starts crowded — the mobile-first base.
    expect(workspace.getAttribute('data-evidence-topology')).toBe('crowded')
    const list = workspace.querySelector<HTMLElement>('[data-evidence-pane="list"]')
    const detail = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    expect(list).not.toBeNull()
    expect(detail).not.toBeNull()
    if (!list || !detail) throw new Error('Expected both evidence panes')

    // Before drilling the list is the only visible surface.
    expect(list).toBeVisible()
    expect(detail).not.toBeVisible()

    fireEvent.click(within(list).getByRole('button', { name: /Requirement diffs/ }))

    expect(detail).toBeVisible()
    expect(list).not.toBeVisible()
    const diffDetail = detail.querySelector<HTMLElement>(
      '[data-evidence-detail="requirement-diffs"]'
    )
    expect(diffDetail).not.toBeNull()
    if (diffDetail) {
      expect(within(diffDetail).getByRole('heading', { name: 'Requirement diffs' })).toBeVisible()
      expect(within(diffDetail).getByText('Unavailable in static snapshot')).toBeVisible()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Back to evidence list' }))

    // Back restores the list while the drilled detail stays mounted (no refetch surface loss)
    // and the row selection is preserved for the next entry.
    expect(list).toBeVisible()
    expect(detail).not.toBeVisible()
    expect(detail.querySelector('[data-evidence-detail="requirement-diffs"] h3')).not.toBeNull()
    expect(
      within(list)
        .getByRole('button', { name: /Requirement diffs/ })
        .getAttribute('aria-current')
    ).toBe('true')
  })

  it('hands keyboard focus to the back affordance on drill and back to the originating row', () => {
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    expect(workspace.getAttribute('data-evidence-topology')).toBe('crowded')

    const row = within(workspace).getByRole('button', {
      name: /Archived validation/,
    }) as HTMLButtonElement
    row.focus()
    fireEvent.click(row)

    const back = screen.getByRole('button', { name: 'Back to evidence list' })
    expect(document.activeElement).toBe(back)

    fireEvent.click(back)
    expect(document.activeElement).toBe(row)
    expect(
      document.activeElement?.closest('[data-evidence-pane]')?.getAttribute('data-evidence-pane')
    ).toBe('list')
  })

  it('does not refetch settled diff evidence across a crowded drill and back', async () => {
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    const list = workspace.querySelector<HTMLElement>('[data-evidence-pane="list"]')
    expect(list).not.toBeNull()
    if (!list) throw new Error('Expected the evidence list pane')

    fireEvent.click(within(list).getByRole('button', { name: /Requirement diffs/ }))
    const detail = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    expect(detail).toBeVisible()

    // The mounted section settled its single fetch; drilling back and re-entering must not
    // spawn another one — the sections stay mounted, only visibility changes.
    const settledCalls = diffEvidenceQueryMock.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Back to evidence list' }))
    expect(list).toBeVisible()
    fireEvent.click(within(list).getByRole('button', { name: /Requirement diffs/ }))
    expect(detail).toBeVisible()

    expect(diffEvidenceQueryMock.mock.calls.length).toBe(settledCalls)
  })

  it('shows the list and the selected detail together in a spacious container', () => {
    stubEvidenceResizeObserver(1200)
    routedTabState.selectedTab = 'evidence'
    statusMock.mockReturnValue({
      data: retainedChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    expect(workspace.getAttribute('data-evidence-topology')).toBe('spacious')
    const list = workspace.querySelector<HTMLElement>('[data-evidence-pane="list"]')
    const detail = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    expect(list).not.toBeNull()
    expect(detail).not.toBeNull()
    if (!list || !detail) throw new Error('Expected both evidence panes')

    // Spacious shows both panes without any drill, and no back affordance exists.
    expect(list).toBeVisible()
    expect(detail).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back to evidence list' })).toBeNull()
    expect(within(detail).getByRole('heading', { name: 'Summary & paths' })).toBeVisible()

    // Selecting another row keeps both panes visible.
    fireEvent.click(within(list).getByRole('button', { name: /Archived validation/ }))
    expect(list).toBeVisible()
    expect(detail).toBeVisible()
    expect(within(detail).getByRole('heading', { name: 'Archived validation' })).toBeInTheDocument()
  })

  it('falls back to the shared content document tab when no artifact tab is available', () => {
    statusMock.mockReturnValue({
      data: {
        changeName: 'Extract Terminal View Webcomponent',
        schemaName: 'opsx-collab-pr-loop',
        isPlanningComplete: false,
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
    expect(screen.getByRole('button', { name: 'Evidence' })).toBeTruthy()
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
        isPlanningComplete: true,
        applyRequires: [],
        artifacts: [
          { id: 'implementation', outputPath: 'implementation.md', status: 'done', requires: [] },
        ],
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
