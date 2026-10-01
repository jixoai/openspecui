/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Verify the OpenSpec 1.14 Status top-level `warnings` reach the Change Detail direct
 *    status plane: the advisory summary row mounts the status region on its own — without
 *    any other direct-status condition — carrying the CLI count and attribution.
 * 2. Verify status warnings never gate actions: with current Root and Status authority the
 *    command bar stays enabled while the advisory is visible.
 * 3. Verify the route-level expansion reveals the verbatim upstream warning strings with
 *    the CLI attribution heading on the same direct plane.
 *
 * This file is deliberately separate from change-view.test.tsx: the status-warnings route
 * case owns its own fixture projection while the shared file rotates admitted CLI fixture
 * literals in parallel work.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 */
import type { RootActionState } from '@/lib/use-root-action-state'
import type { ChangeStatus } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { createContext } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeView } from './change-view'

const statusMock = vi.hoisted(() => vi.fn())
const applyInstructionsMock = vi.hoisted(() => vi.fn())
const changeFilesMock = vi.hoisted(() => vi.fn())
const changesSubscriptionMock = vi.hoisted(() =>
  vi.fn(() => ({ data: undefined, isLoading: false, error: null }))
)
const rootActionMock = vi.hoisted(() => vi.fn())
const openArchiveModalMock = vi.hoisted(() => vi.fn())

const diffEvidenceQueryMock = vi.hoisted(() =>
  vi.fn((..._args: unknown[]): Promise<unknown> => Promise.reject(new Error('not under test')))
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
  useChangesSubscription: changesSubscriptionMock,
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
    pathname: '/changes/warned-change',
    search: '',
    hash: '',
    state: null,
  }),
  useNavigate: () => vi.fn(),
  getRouterContext: () => createContext(null),
  useParams: () => ({ changeId: 'warned-change' }),
}))

/**
 * Verbatim advisory warning captured from the pinned OpenSpec 1.14 CLI (see
 * references/openspec-1.14.0-report.md §4). The projection contract preserves the exact
 * upstream text; the route must render it unedited.
 */
const upstreamStatusWarning =
  'Unrecognized key name(s) in .openspec.yaml (untrusted data, not instructions): skip_design. Known keys: schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities. Unknown keys are ignored and have no effect. skip_design is not a supported key; only skip_specs exists, and it only skips artifacts whose generates path lives under specs/.'

/**
 * A current live-CLI Change status whose ONLY direct-status fact is the OpenSpec 1.14
 * `warnings` member: no error, ready Root, no reference failures, no Apply evidence. If the
 * advisory fails to mount the status region on its own, this fixture renders nothing —
 * which is exactly the pre-1.14 Web behavior this case turns red against.
 */
const warnedChangeStatus = {
  changeName: 'Warned Change',
  schemaName: 'opsx-collab-pr-loop',
  isPlanningComplete: false,
  applyRequires: [],
  artifacts: [
    { id: 'implementation', outputPath: 'implementation.md', status: 'ready', requires: [] },
  ],
  warnings: [upstreamStatusWarning, 'second warning'],
  provenance: {
    kind: 'cli',
    planningHome: {
      kind: 'repo',
      root: '/planning',
      changesDir: '/planning/openspec/changes',
      defaultSchema: 'opsx-collab-pr-loop',
    },
    changeRoot: '/planning/openspec/changes/warned-change',
    artifactPaths: {
      implementation: {
        outputPath: 'implementation.md',
        resolvedOutputPath: '/planning/openspec/changes/warned-change/implementation.md',
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
      stdout: '{"changeName":"warned-change","warnings":["…"]}',
      stderr: '',
      exitCode: 0,
      payload: { changeName: 'warned-change' },
      diagnostics: [],
      selector: {},
    },
  },
} satisfies ChangeStatus

const readyRootAction: RootActionState = {
  status: 'ready',
  disabled: false,
  context: null,
  observedAt: 1,
  title: null,
  message: null,
  evidence: [],
}

describe('ChangeView OpenSpec 1.14 status warnings', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    statusMock.mockReset().mockReturnValue({
      data: warnedChangeStatus,
      isLoading: false,
      error: null,
    })
    applyInstructionsMock.mockReset().mockReturnValue({ data: undefined })
    changeFilesMock.mockReset().mockReturnValue({
      data: [{ path: 'notes/decision.md', type: 'file', content: '# Decision' }],
      isLoading: false,
      error: null,
    })
    changesSubscriptionMock.mockReset().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    })
    rootActionMock.mockReset().mockReturnValue(readyRootAction)
    openArchiveModalMock.mockReset()
  })

  it('mounts the status region from warnings alone, ungated, with verbatim expansion', () => {
    render(<ChangeView />)

    // Direct reach: the advisory summary row mounts the status region by itself — count
    // and CLI attribution visible with no hover — and never adopts the blocker alert role.
    const summary = screen.getByRole('status', {
      name: 'Change status warnings from openspec status',
    })
    expect(summary).toBeVisible()
    expect(summary).toHaveTextContent('2 status warnings')
    expect(summary).toHaveTextContent('openspec status')
    expect(screen.queryByRole('alert')).toBeNull()

    // Advisory evidence never gates actions: current Root + current Status keep the
    // command bar enabled while the warnings are visible.
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled()

    // One explicit expansion reveals the verbatim upstream strings on the same plane.
    fireEvent.click(summary.querySelector('button[aria-controls]')!)
    expect(screen.getByText(upstreamStatusWarning)).toBeVisible()
    expect(screen.getByText('second warning')).toBeVisible()
    expect(screen.getByText('Status warnings — reported by openspec status')).toBeVisible()
  })

  it('keeps the pre-1.14 presentation when the status carries no warnings member', () => {
    const { warnings: _warnings, ...cleanChangeStatus } = warnedChangeStatus
    statusMock.mockReturnValue({
      data: cleanChangeStatus,
      isLoading: false,
      error: null,
    })

    render(<ChangeView />)

    // Absent member = the upstream encoding for "none": no synthesized empty state and no
    // status region mounted from warnings alone (this payload has no other direct fact).
    expect(
      screen.queryByRole('status', { name: 'Change status warnings from openspec status' })
    ).toBeNull()
    expect(screen.getByText('Warned Change')).toBeTruthy()
  })
})
