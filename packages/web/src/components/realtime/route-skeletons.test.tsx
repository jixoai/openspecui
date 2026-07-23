/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove each route skeleton mirrors its real layout (gap, divider, grid cols, row structure).
 * 2. Prove the default inventory mode never clumps rows (plain has space-y-2 gap).
 *
 * Owner direction (2026-07-24): skeleton 之间需要有 gap，结构需符合客观布局情况。
 * Evidence type: unit (focused Vitest lane).
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ArchiveListSkeleton,
  ChangeListSkeleton,
  ConfigFormSkeleton,
  DashboardSummarySkeleton,
  DashboardTrendsSkeleton,
  DetailPanelSkeleton,
  GitWorktreeSkeleton,
  RealtimeSkeletonInventory,
  SpecListSkeleton,
} from './index'

function firstChild(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement
}

describe('route skeletons mirror real layout', () => {
  it('ChangeListSkeleton uses list-divide (border + divide-y), not a clumped stack', () => {
    const { container } = render(<ChangeListSkeleton count={3} />)
    const root = firstChild(container)
    expect(root.className).toContain('divide-y')
    expect(root.className).toContain('border')
    // Each row mirrors the real px-4 py-3 flex justify-between structure.
    const rows = root.querySelectorAll(':scope > div')
    expect(rows.length).toBe(3)
    expect(rows[0].className).toContain('px-4 py-3')
  })

  it('ArchiveListSkeleton and SpecListSkeleton share the list-divide geometry', () => {
    const a = render(<ArchiveListSkeleton count={2} />)
    expect(firstChild(a.container).className).toContain('divide-y')
    a.unmount()
    const s = render(<SpecListSkeleton count={2} />)
    expect(firstChild(s.container).className).toContain('divide-y')
  })

  it('DashboardSummarySkeleton mirrors the responsive metric grid', () => {
    const { container } = render(<DashboardSummarySkeleton count={6} />)
    const root = firstChild(container)
    expect(root.className).toContain('grid')
    expect(root.className).toContain('lg:grid-cols-6')
    expect(root.querySelectorAll(':scope > div').length).toBe(6)
  })

  it('DashboardTrendsSkeleton mirrors the 2-col trends grid', () => {
    const { container } = render(<DashboardTrendsSkeleton count={2} />)
    const root = firstChild(container)
    expect(root.className).toContain('sm:grid-cols-2')
    expect(root.querySelectorAll(':scope > div').length).toBe(2)
  })

  it('GitWorktreeSkeleton mirrors bordered worktree rows with a gap', () => {
    const { container } = render(<GitWorktreeSkeleton count={3} />)
    const root = firstChild(container)
    // plain mode => space-y-2 (gap, never clumped).
    expect(root.className).toContain('space-y-2')
    const rows = root.querySelectorAll(':scope > div')
    expect(rows.length).toBe(3)
    expect(rows[0].className).toContain('border')
  })

  it('DetailPanelSkeleton renders stacked content lines with a gap', () => {
    const { container } = render(<DetailPanelSkeleton count={5} />)
    const root = firstChild(container)
    expect(root.className).toContain('gap-3')
    expect(root.querySelectorAll('.rt-skeleton').length).toBe(5)
  })

  it('ConfigFormSkeleton mirrors a section card with header + labeled fields', () => {
    const { container } = render(<ConfigFormSkeleton fields={3} />)
    const root = firstChild(container)
    expect(root.tagName).toBe('SECTION')
    expect(root.className).toContain('border')
    expect(root.className).toContain('p-4')
    // 3 field rows, each with a label block + input block.
    const fieldRows = root.querySelectorAll(':scope > div:last-child > div')
    expect(fieldRows.length).toBe(3)
  })
})

describe('RealtimeSkeletonInventory default gap', () => {
  it('plain mode (default) applies space-y-2 so rows are never clumped', () => {
    const { container } = render(<RealtimeSkeletonInventory count={3} />)
    expect(firstChild(container).className).toContain('space-y-2')
  })

  it('grid-cards mode applies a gap', () => {
    const { container } = render(<RealtimeSkeletonInventory mode="grid-cards" count={2} />)
    expect(firstChild(container).className).toContain('gap-3')
  })
})
