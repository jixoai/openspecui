/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove Board selects readonly/static and interactive/live presentation owners.
 * 2. Prove a pending active projection does not hide current archive rows.
 *
 * Original request (2026-07-28): implement regional Board lifecycle and static ReadonlyKanban.
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
        id: '2026-07-28-archive-a',
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
    activeState,
  }: {
    archivedItems: unknown[]
    activeState: { initialLoading: boolean }
  }) => (
    <div data-testid="interactive-kanban">
      archives:{archivedItems.length};active-loading:{String(activeState.initialLoading)}
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

    expect(screen.getByTestId('interactive-kanban').textContent).toBe(
      'archives:1;active-loading:true'
    )
    expect(screen.queryByTestId('readonly-kanban')).toBeNull()
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
