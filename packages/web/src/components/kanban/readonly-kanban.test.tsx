/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove ReadonlyKanban renders exact lane facts and navigation.
 * 2. Prove the shared readonly surface exposes no operation or drag affordance.
 * 3. Lock its self-owned 1/2/4-column container topology without horizontal scrolling.
 *
 * Original request (2026-07-28): add ReadonlyKanban to Dashboard.
 * Owner correction (2026-07-28): use container queries for 4x1, 2x2, and 1x4 without horizontal scrolling.
 */
import { createTrackedTaskProgress } from '@openspecui/core/task-progress'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadonlyKanban } from './readonly-kanban'

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

afterEach(cleanup)

function progress(total: number, completed: number) {
  return createTrackedTaskProgress(
    Array.from({ length: total }, (_, index) => ({
      id: `task-${index}`,
      text: `Task ${index}`,
      completed: index < completed,
      location: { filePath: 'tasks.md', taskIndex: index + 1 },
    }))
  )
}

describe('ReadonlyKanban', () => {
  it('owns a container-responsive grid without horizontal scrolling', () => {
    render(
      <ReadonlyKanban
        activeItems={[]}
        archivedItems={[]}
        activeCounts={{ 'no-tasks': 0, 'in-progress': 0, complete: 0 }}
        archivedCount={0}
      />
    )

    const container = screen.getByTestId('readonly-kanban')
    expect(container.classList.contains('@container')).toBe(true)

    const grid = screen.getByTestId('readonly-kanban-grid')
    expect(grid.classList.contains('grid-cols-1')).toBe(true)
    expect(grid.classList.contains('@[32rem]:grid-cols-2')).toBe(true)
    expect(grid.classList.contains('@[64rem]:grid-cols-4')).toBe(true)
    expect(grid.className).not.toContain('overflow-x-auto')
    expect(grid.className).not.toContain('auto-cols-')
    expect(grid.className).not.toContain('grid-flow-col')
  })

  it('renders objective lanes without operation or drag controls', () => {
    const { container } = render(
      <ReadonlyKanban
        activeItems={[
          { id: 'no-tasks', name: 'No tasks', trackedTaskProgress: progress(0, 0), updatedAt: 1 },
          { id: 'remaining', name: 'Remaining', trackedTaskProgress: progress(2, 0), updatedAt: 2 },
          { id: 'complete', name: 'Complete', trackedTaskProgress: progress(1, 1), updatedAt: 3 },
        ]}
        archivedItems={[
          {
            id: '2026-07-28-archived',
            name: 'Archived change',
            trackedTaskProgress: progress(1, 0),
            updatedAt: 4,
          },
        ]}
        activeCounts={{ 'no-tasks': 1, 'in-progress': 1, complete: 1 }}
        archivedCount={1}
      />
    )

    expect(screen.getByText('No tracked tasks')).toBeTruthy()
    expect(screen.getByText('Tasks remaining')).toBeTruthy()
    expect(screen.getByText('Tasks complete')).toBeTruthy()
    expect(screen.getByText('Archived')).toBeTruthy()
    expect(screen.getByText('Archived change')).toBeTruthy()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[draggable="true"]')).toBeNull()
  })
})
