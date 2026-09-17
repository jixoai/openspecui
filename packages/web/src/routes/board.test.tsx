/**
 * Orthogonal intents (updated 2026-09-18 Asia/Shanghai):
 * 1. Prove Board selects readonly/static and interactive/live presentation owners.
 * 2. Prove a pending active projection does not hide current archive rows.
 * 3. Prove the live route consumes shell height and contains page-level overflow.
 * 4. Keep the archive fixture inside the trailing 30-day window regardless of wall-clock date.
 * 5. Prove generic proposal headings fall back to the change id on Kanban cards.
 *
 * Original request (2026-07-28): implement regional Board lifecycle and static ReadonlyKanban.
 * Owner correction (2026-07-28): prevent competing horizontal scrollbars on narrow `/board`.
 * Original request (2026-08-28, issue #258 delivery): the dated archive id `2026-07-28-archive-a`
 *   fell out of the default 30-day Board range exactly 31 days later and started failing CI
 *   deterministically; derive the fixture date from the current day instead.
 * Original request (2026-09-18): owner walkthrough — every Kanban card showed the generic
 * scaffold heading "Proposal"; Board never received the changeDisplayTitle fallback (Case 5).
 */
import type { ArchiveMeta, ChangeMeta } from '@openspecui/core'
import type { TrackedTaskProgress } from '@openspecui/core/task-progress'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Board } from './board'

const fixture = vi.hoisted(() => ({
  staticMode: false,
  changes: {
    data: undefined as ChangeMeta[] | undefined,
    isLoading: true,
    isUpdating: false,
    error: null as Error | null,
    rowErrors: [],
    progress: null,
  },
  archives: {
    data: [
      {
        // Dated ids drive the trailing 30-day range filter; derive the fixture date from the
        // current day so the archive never ages out of the window and flips this suite red.
        id: `${new Date().toISOString().slice(0, 10)}-archive-a`,
        name: 'Archive A',
        trackedTaskProgress: {
          tasks: [],
          total: 0,
          completed: 0,
          remaining: 0,
          phase: 'no-tasks',
          source: {
            kind: 'none',
            artifactId: null,
            outputPath: null,
            filePaths: [],
          },
        } satisfies TrackedTaskProgress,
        documentChecklistSummary: { groups: [], total: 0, completed: 0, remaining: 0 },
        createdAt: 1,
        updatedAt: 1,
      },
    ] satisfies ArchiveMeta[],
    isLoading: false,
    isUpdating: false,
    error: null as Error | null,
  },
  status: {
    data: [],
    isLoading: false,
    error: null,
    authority: { state: 'current' } as
      | { state: 'current' }
      | { state: 'waiting'; reason: 'pending' },
  },
}))

const operatorLauncher = vi.hoisted(() => vi.fn())

vi.mock('@/lib/static-mode', () => ({ isStaticMode: () => fixture.staticMode }))
vi.mock('@/lib/use-subscription', () => ({
  useChangesSubscription: () => fixture.changes,
  useArchivesSubscription: () => fixture.archives,
}))
vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: () => fixture.status,
}))
vi.mock('@/lib/use-change-operator-launcher', () => ({
  useChangeOperatorLauncher: (gate: unknown) => {
    operatorLauncher(gate)
    return {
      rootAction: { status: 'ready', disabled: false, message: null },
      launchApply: vi.fn(),
      launchArchive: vi.fn(),
    }
  },
}))
vi.mock('@/components/kanban/interactive-kanban', () => ({
  InteractiveKanban: ({
    archivedItems,
    activeItems,
    activeState,
  }: {
    archivedItems: Array<{ id: string; name: string }>
    activeItems: Array<{ id: string; name: string }>
    activeState: { initialLoading: boolean }
  }) => (
    <div data-testid="interactive-kanban">
      archives:{archivedItems.length};
      archive-names:{archivedItems.map((item) => item.name).join('|')};
      active-names:{activeItems.map((item) => item.name).join('|')};
      active-loading:{String(activeState.initialLoading)}
    </div>
  ),
}))
vi.mock('@/components/kanban/readonly-kanban', () => ({
  ReadonlyKanban: () => <div data-testid="readonly-kanban" />,
}))

describe('Board route composition', () => {
  beforeEach(() => {
    fixture.staticMode = false
    fixture.status.authority = { state: 'current' }
    operatorLauncher.mockClear()
  })
  afterEach(cleanup)

  it('keeps current archive rows visible while active rows are initially loading', () => {
    render(<Board />)

    expect(screen.getByTestId('interactive-kanban').textContent).toContain('archives:1')
    expect(screen.getByTestId('interactive-kanban').textContent).toContain(
      'active-loading:true'
    )
    expect(screen.queryByTestId('readonly-kanban')).toBeNull()
  })

  it('falls back to the change id for generic proposal headings on Kanban cards', () => {
    fixture.changes = {
      ...fixture.changes,
      isLoading: false,
      data: [
        {
          id: 'task-parity',
          name: 'Proposal',
          trackedTaskProgress:
            fixture.archives.data[0].trackedTaskProgress,
          documentChecklistSummary: { groups: [], total: 0, completed: 0, remaining: 0 },
          cliTaskSummary: null,
          createdAt: 1,
          updatedAt: 1,
        } satisfies ChangeMeta,
      ],
    }
    fixture.archives = {
      ...fixture.archives,
      data: [
        {
          ...fixture.archives.data[0],
          name: 'Proposal',
        },
      ],
    }

    render(<Board />)

    const kanban = screen.getByTestId('interactive-kanban')
    expect(kanban.textContent).toContain('active-names:task-parity')
    // The archive falls back to its own dated id; an informative name would be kept verbatim.
    expect(kanban.textContent).toMatch(/archive-names:\d{4}-\d{2}-\d{2}-archive-a/)
    expect(kanban.textContent).not.toContain('Proposal')
  })

  it('bounds the live Board to the shell block-size and contains route overflow', () => {
    const { container } = render(<Board />)

    const route = container.firstElementChild
    expect(route).toHaveClass('flex', 'h-full', 'min-h-0', 'min-w-0', 'flex-col', 'overflow-hidden')
    expect(route).not.toHaveClass('overflow-x-auto', 'overflow-y-auto')
  })

  it('uses the callback-free ReadonlyKanban in static mode', () => {
    fixture.staticMode = true
    fixture.changes = { ...fixture.changes, data: [], isLoading: false }
    render(<Board />)

    expect(screen.getByTestId('readonly-kanban')).toBeTruthy()
    expect(screen.queryByTestId('interactive-kanban')).toBeNull()
  })

  it('revokes the Operator gate while retained OPSX Status is not current', () => {
    fixture.changes = { ...fixture.changes, data: [], isLoading: false }
    fixture.status.authority = { state: 'waiting', reason: 'pending' }

    render(<Board />)

    expect(operatorLauncher).toHaveBeenLastCalledWith({
      applyCurrent: false,
      archiveCurrent: true,
    })
  })
})
