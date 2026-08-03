/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove Kanban lane layers share one positioning-free Grid cell in Chromium.
 * 2. Prove compact/full padding geometry and progressive visual veils reach computed CSS.
 * 3. Prove one lane scrolls beneath its fixed header without moving a sibling lane.
 *
 * Original request (2026-08-03): layer title and bottom space over a padded list with Grid, gradients, and progressive backdrop blur.
 * Owner acceptance boundary (2026-07-20): Agents stop at basic component Playwright evidence.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KanbanLaneViewport } from './kanban-lane-viewport'

function requireElement<T extends Element>(element: T | null, message: string): T {
  if (element === null) throw new Error(message)
  return element
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function LaneRows({ prefix }: { prefix: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 16 }, (_, index) => (
        <div
          key={index}
          data-testid={`${prefix}-row-${index}`}
          className="border-border bg-card h-10 border px-2 py-1 text-xs"
        >
          {prefix} row {index + 1}
        </div>
      ))}
    </div>
  )
}

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})

describe('KanbanLaneViewport browser contract', () => {
  it('layers visual edges over independently scrolling padded lane content', async () => {
    const onHeaderAction = vi.fn()
    const view = render(
      <div className="grid h-48 w-[36rem] grid-cols-2 gap-4">
        <KanbanLaneViewport
          laneId="in-progress"
          density="full"
          className="h-full"
          header={
            <div className="flex h-full items-center justify-between px-1">
              <span>Full lane</span>
              <button type="button" className="pointer-events-auto" onClick={onHeaderAction}>
                Header action
              </button>
            </div>
          }
        >
          <LaneRows prefix="full" />
        </KanbanLaneViewport>
        <KanbanLaneViewport
          laneId="complete"
          density="compact"
          className="h-full"
          header={<div className="flex h-full items-center px-1">Compact lane</div>}
        >
          <LaneRows prefix="compact" />
        </KanbanLaneViewport>
      </div>
    )

    const fullLane = requireElement(
      view.container.querySelector<HTMLElement>('[data-kanban-lane="in-progress"]'),
      'Expected full Kanban lane.'
    )
    const compactLane = requireElement(
      view.container.querySelector<HTMLElement>('[data-kanban-lane="complete"]'),
      'Expected compact Kanban lane.'
    )
    const fullScroller = requireElement(
      fullLane.querySelector<HTMLElement>('[data-kanban-lane-scroll]'),
      'Expected full lane scroller.'
    )
    const compactScroller = requireElement(
      compactLane.querySelector<HTMLElement>('[data-kanban-lane-scroll]'),
      'Expected compact lane scroller.'
    )
    const header = requireElement(
      fullLane.querySelector<HTMLElement>('[data-kanban-lane-header]'),
      'Expected full lane header.'
    )
    const topVeil = requireElement(
      fullLane.querySelector<HTMLElement>('[data-kanban-lane-veil="top"]'),
      'Expected top visual veil.'
    )
    const bottomVeil = requireElement(
      fullLane.querySelector<HTMLElement>('[data-kanban-lane-veil="bottom"]'),
      'Expected bottom visual veil.'
    )
    const firstRow = requireElement(
      fullLane.querySelector<HTMLElement>('[data-testid="full-row-0"]'),
      'Expected first full lane row.'
    )
    const headerAction = requireElement(
      fullLane.querySelector<HTMLButtonElement>('button'),
      'Expected interactive header action.'
    )

    expect(getComputedStyle(fullLane).display).toBe('grid')
    const stackArea = getComputedStyle(fullScroller).gridArea
    expect(getComputedStyle(header).gridArea).toBe(stackArea)
    expect(getComputedStyle(topVeil).gridArea).toBe(stackArea)
    expect(getComputedStyle(bottomVeil).gridArea).toBe(stackArea)
    for (const layer of [fullScroller, header, topVeil, bottomVeil]) {
      expect(getComputedStyle(layer).position).toBe('static')
    }

    expect(getComputedStyle(fullScroller).paddingBlockStart).toBe('44px')
    expect(getComputedStyle(fullScroller).paddingBlockEnd).toBe('8px')
    expect(getComputedStyle(compactScroller).paddingBlockStart).toBe('40px')
    expect(getComputedStyle(compactScroller).paddingBlockEnd).toBe('24px')
    expect(getComputedStyle(header).pointerEvents).toBe('none')
    expect(getComputedStyle(headerAction).pointerEvents).toBe('auto')

    const topVeilStyle = getComputedStyle(topVeil)
    const backdropFilter =
      topVeilStyle.backdropFilter || topVeilStyle.getPropertyValue('-webkit-backdrop-filter')
    const maskImage = topVeilStyle.maskImage || topVeilStyle.getPropertyValue('-webkit-mask-image')
    expect(backdropFilter).toContain('blur(6px)')
    expect(maskImage).toContain('linear-gradient')
    expect(topVeilStyle.backgroundImage).toContain('linear-gradient')

    fireEvent.click(headerAction)
    expect(onHeaderAction).toHaveBeenCalledOnce()

    expect(fullScroller.scrollHeight).toBeGreaterThan(fullScroller.clientHeight)
    const headerTopBefore = header.getBoundingClientRect().top
    const rowTopBefore = firstRow.getBoundingClientRect().top
    fullScroller.scrollTop = 80
    fireEvent.scroll(fullScroller)
    await nextFrame()

    expect(fullScroller.scrollTop).toBeGreaterThan(0)
    expect(compactScroller.scrollTop).toBe(0)
    expect(Math.abs(header.getBoundingClientRect().top - headerTopBefore)).toBeLessThan(0.5)
    expect(firstRow.getBoundingClientRect().top).toBeLessThan(rowTopBefore)
    expect(firstRow.getBoundingClientRect().top).toBeLessThan(header.getBoundingClientRect().bottom)
  })

  it('resolves veil gradients from the active application theme', async () => {
    const view = render(
      <div className="h-48 w-64">
        <KanbanLaneViewport
          laneId="archived"
          density="full"
          className="h-full"
          header={<div className="flex h-full items-center px-1">Archived</div>}
        >
          <LaneRows prefix="theme" />
        </KanbanLaneViewport>
      </div>
    )
    const topVeil = requireElement(
      view.container.querySelector<HTMLElement>('[data-kanban-lane-veil="top"]'),
      'Expected themed top visual veil.'
    )
    const lightGradient = getComputedStyle(topVeil).backgroundImage

    document.documentElement.classList.add('dark')
    await nextFrame()

    expect(getComputedStyle(topVeil).backgroundImage).not.toBe(lightGradient)
  })
})
