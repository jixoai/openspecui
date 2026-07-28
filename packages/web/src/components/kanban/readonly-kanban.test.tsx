/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove ReadonlyKanban renders exact lane facts and navigation.
 * 2. Prove the shared readonly surface exposes no operation or drag affordance.
 *
 * Original request (2026-07-28): add ReadonlyKanban to Dashboard.
 */
import { createTrackedTaskProgress } from '@openspecui/core/task-progress'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ReadonlyKanban } from './readonly-kanban'

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

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
