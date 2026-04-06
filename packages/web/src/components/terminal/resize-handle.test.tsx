import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResizeHandle } from './resize-handle'

describe('ResizeHandle', () => {
  afterEach(() => {
    document.body.style.userSelect = ''
  })

  it('resizes from the full hit area without mutating the global cursor', () => {
    const onResize = vi.fn()

    const { container } = render(
      <div>
        <ResizeHandle onResize={onResize} minHeight={100} maxHeight={500} />
        <div>Bottom area</div>
      </div>
    )

    const slot = container.firstElementChild?.firstElementChild as HTMLDivElement
    const handle = slot.firstElementChild as HTMLDivElement
    const panel = slot.nextElementSibling as HTMLDivElement

    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      value: 240,
    })

    fireEvent.mouseDown(handle, {
      clientY: 320,
    })

    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('none')

    fireEvent.mouseMove(document, {
      clientY: 280,
    })

    expect(onResize).toHaveBeenCalledWith(280)

    fireEvent.mouseUp(document)

    expect(document.body.style.userSelect).toBe('')
  })

  it('supports touch dragging via document listeners', () => {
    const onResize = vi.fn()

    const { container } = render(
      <div>
        <ResizeHandle onResize={onResize} minHeight={100} maxHeight={500} />
        <div>Bottom area</div>
      </div>
    )

    const slot = container.firstElementChild?.firstElementChild as HTMLDivElement
    const handle = slot.firstElementChild as HTMLDivElement
    const panel = slot.nextElementSibling as HTMLDivElement

    Object.defineProperty(panel, 'offsetHeight', {
      configurable: true,
      value: 240,
    })

    fireEvent.touchStart(handle, {
      touches: [{ clientY: 320 }],
    })

    expect(document.body.style.userSelect).toBe('none')

    fireEvent.touchMove(document, {
      touches: [{ clientY: 280 }],
    })

    expect(onResize).toHaveBeenCalledWith(280)

    fireEvent.touchEnd(document)

    expect(document.body.style.userSelect).toBe('')
  })
})
