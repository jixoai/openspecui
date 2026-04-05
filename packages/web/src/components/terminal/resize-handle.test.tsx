import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResizeHandle } from './resize-handle'

describe('ResizeHandle', () => {
  beforeEach(() => {
    vi.stubGlobal('PointerEvent', MouseEvent)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

    fireEvent.pointerDown(handle, {
      clientY: 320,
      pointerId: 1,
    })

    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('none')

    fireEvent.pointerMove(handle, {
      clientY: 280,
      pointerId: 1,
    })

    expect(onResize).toHaveBeenCalledWith(280)

    fireEvent.pointerUp(handle, {
      clientY: 280,
      pointerId: 1,
    })

    expect(document.body.style.userSelect).toBe('')
  })
})
