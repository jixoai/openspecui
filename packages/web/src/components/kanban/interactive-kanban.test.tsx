/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove live card commands respect Root and projection authority.
 * 2. Prove Apply/Archive remain Operator callbacks rather than lane mutations.
 * 3. Prove archive drop resolves DataTransfer identity against current active rows.
 * 4. Prove one inline scroll owner and independent lane block-scroll owners.
 *
 * Original request (2026-07-28): implement accessible commands and current-row archive drag.
 * Owner correction (2026-07-28): remove double horizontal scrolling and let each lane scroll vertically.
 * Original request (2026-08-01): keep Kanban fixtures aligned with exact OpenSpec 1.7 artifact dependencies.
 */
import { createTrackedTaskProgress } from '@openspecui/core/task-progress'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InteractiveKanban, type InteractiveKanbanProps } from './interactive-kanban'

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

const activeItem = {
  id: 'change-a',
  name: 'Change A',
  trackedTaskProgress: progress(2, 0),
  updatedAt: 1,
}

const readyStatus = {
  changeName: 'change-a',
  schemaName: 'spec-driven',
  isComplete: false,
  applyRequires: ['proposal'],
  artifacts: [{ id: 'proposal', outputPath: 'proposal.md', status: 'done' as const, requires: [] }],
  provenance: { kind: 'static' as const },
}

function props(overrides: Partial<InteractiveKanbanProps> = {}): InteractiveKanbanProps {
  return {
    activeItems: [activeItem],
    archivedItems: [],
    statuses: [readyStatus],
    range: '30d',
    onRangeChange: vi.fn(),
    activeState: {
      initialLoading: false,
      updating: false,
      current: true,
      error: null,
      rowErrors: [],
      progress: null,
    },
    archiveState: {
      initialLoading: false,
      updating: false,
      current: true,
      error: null,
    },
    rootReady: true,
    rootBlockedReason: null,
    applyStatusCurrent: true,
    applyStatusError: null,
    onApply: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  }
}

describe('InteractiveKanban', () => {
  afterEach(cleanup)

  it('owns horizontal overflow once and gives every lane an independent vertical row scroller', () => {
    const { container } = render(<InteractiveKanban {...props()} />)

    const root = container.firstElementChild
    expect(root).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden')

    const horizontalOwners = container.querySelectorAll('.overflow-x-auto')
    expect(horizontalOwners).toHaveLength(1)
    const grid = container.querySelector('[data-kanban-grid]')
    expect(grid).toBe(horizontalOwners.item(0))
    expect(grid).toHaveClass('min-h-0', 'flex-1', 'overflow-x-auto', 'overflow-y-hidden')

    const lanes = container.querySelectorAll('[data-lane]')
    const rowScrollers = container.querySelectorAll('[data-lane-scroll]')
    expect(lanes).toHaveLength(4)
    expect(rowScrollers).toHaveLength(4)
    lanes.forEach((lane) => {
      expect(lane).toHaveClass('flex', 'min-h-0', 'flex-col', 'overflow-hidden')
      const rowScroller = lane.querySelector('[data-lane-scroll]')
      expect(rowScroller).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overflow-x-hidden')
      expect(rowScroller?.contains(lane.querySelector('header'))).toBe(false)
    })
  })

  it('launches explicit Apply and Archive callbacks for a current row', () => {
    const input = props()
    render(<InteractiveKanban {...input} />)

    fireEvent.click(screen.getByRole('button', { name: 'Apply Change A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive Change A' }))

    expect(input.onApply).toHaveBeenCalledWith(activeItem)
    expect(input.onArchive).toHaveBeenCalledWith(activeItem)
  })

  it('keeps retained rows visible but disables commands and drag while authority is stale', () => {
    const input = props({
      rootReady: false,
      rootBlockedReason: 'Refreshing planning root',
      activeState: {
        initialLoading: false,
        updating: true,
        current: false,
        error: null,
        rowErrors: [],
        progress: null,
      },
    })
    const { container } = render(<InteractiveKanban {...input} />)

    expect(screen.getByText('Change A')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply Change A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive Change A' })).toBeDisabled()
    expect(container.querySelector('article')?.getAttribute('draggable')).not.toBe('true')
  })

  it('rejects an archive drop after the dragged id disappears from current rows', () => {
    const input = props()
    const { container, rerender } = render(<InteractiveKanban {...input} />)
    const card = container.querySelector('article')
    if (!card) throw new Error('Expected active card.')
    const values = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      types: ['application/x-openspecui-change-id'],
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? '',
    }

    fireEvent.dragStart(card, { dataTransfer })
    rerender(<InteractiveKanban {...input} activeItems={[]} />)
    const archivedLane = container.querySelector('[data-lane="archived"]')
    if (!archivedLane) throw new Error('Expected Archived lane.')
    fireEvent.drop(archivedLane, { dataTransfer })

    expect(input.onArchive).not.toHaveBeenCalled()
  })

  it('exposes Apply Status failure without blocking an otherwise current Archive command', () => {
    const input = props({
      applyStatusCurrent: false,
      applyStatusError: new Error('status projection failed'),
    })
    render(<InteractiveKanban {...input} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Apply status: status projection failed')
    expect(screen.getByRole('button', { name: 'Apply Change A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive Change A' })).toBeEnabled()
  })
})
