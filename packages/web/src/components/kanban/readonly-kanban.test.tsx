/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prove ReadonlyKanban renders exact lane facts and navigation.
 * 2. Prove the shared readonly surface exposes no operation or drag affordance.
 * 3. Lock its self-owned 1/2/4-column container topology without horizontal scrolling.
 * 4. Prove compact Pending geometry stays fixed while every lane owns one layered vertical viewport.
 *
 * Original request (2026-07-28): add ReadonlyKanban to Dashboard.
 * Owner correction (2026-07-28): use container queries for 4x1, 2x2, and 1x4 without horizontal scrolling.
 * Original request (2026-07-31): "Kanban 的高度可以固定下来，并且要让每个group都可以独立滚动"
 * Original request (2026-08-03): layer title and bottom space over a padded list with Grid, gradients, and progressive backdrop blur.
 * Owner refinement (2026-08-04): use three blur levels per edge because eight ProgressiveBlur instances render together.
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

  it('keeps compact Pending geometry fixed and gives every lane one layered scroll owner', () => {
    const { container } = render(
      <ReadonlyKanban
        activeItems={[]}
        archivedItems={[]}
        activeCounts={{ 'no-tasks': 0, 'in-progress': 0, complete: 0 }}
        archivedCount={0}
        variant="compact"
        pending
      />
    )

    const kanban = screen.getByTestId('readonly-kanban')
    expect(kanban).toHaveAttribute('aria-busy', 'true')
    expect(kanban.className).toContain('h-[46rem]')
    expect(kanban.className).toContain('@[32rem]:h-[32rem]')
    expect(kanban.className).toContain('@[64rem]:h-72')

    const grid = screen.getByTestId('readonly-kanban-grid')
    expect(grid.className).toContain('grid-rows-4')
    expect(grid.className).toContain('@[32rem]:grid-rows-2')
    expect(grid.className).toContain('@[64rem]:grid-rows-1')

    const lanes = container.querySelectorAll('[data-kanban-lane]')
    expect(lanes).toHaveLength(4)

    const laneScrollOwners = container.querySelectorAll('[data-kanban-lane-scroll]')
    expect(laneScrollOwners).toHaveLength(4)
    for (const lane of lanes) {
      expect(lane).toHaveClass('kanban-lane-viewport', 'grid')
      expect(lane).not.toHaveClass('relative')

      const scroller = lane.querySelector('[data-kanban-lane-scroll]')
      const header = lane.querySelector('[data-kanban-lane-header]')
      expect(scroller).toHaveClass('kanban-lane-viewport__scroll', 'overflow-y-auto')
      expect(header).toHaveClass('kanban-lane-viewport__header')
      expect(scroller?.contains(header)).toBe(false)
      expect(lane.querySelectorAll('[data-kanban-lane-veil]')).toHaveLength(2)
      expect(lane.querySelectorAll('[data-progressive-blur-layer]')).toHaveLength(6)
    }
    expect(container.querySelectorAll('[data-progressive-blur-layer]')).toHaveLength(24)
    expect(container.querySelectorAll('.rt-skeleton').length).toBeGreaterThan(0)
  })
})
