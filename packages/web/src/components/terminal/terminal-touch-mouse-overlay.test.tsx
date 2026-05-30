import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalTouchMouseOverlay } from './terminal-touch-mouse-overlay'

function touchPoint(clientX: number, clientY: number) {
  return { identifier: 1, clientX, clientY }
}

describe('TerminalTouchMouseOverlay', () => {
  const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')

  afterEach(() => {
    cleanup()
    if (elementFromPointDescriptor) {
      Object.defineProperty(document, 'elementFromPoint', elementFromPointDescriptor)
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint')
    }
    vi.restoreAllMocks()
  })

  function mockElementFromPoint(target: Element) {
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    })
  }

  it('converts a touch tap into mouse events on the terminal target below the overlay', () => {
    const events: string[] = []
    const { getByTestId } = render(
      <div data-testid="terminal-host">
        <div data-testid="terminal-screen" className="xterm-screen" />
        <TerminalTouchMouseOverlay sessionId="term-1" />
      </div>
    )

    const target = getByTestId('terminal-screen')
    mockElementFromPoint(target)

    target.addEventListener('mousedown', () => events.push('mousedown'))
    target.addEventListener('mouseup', () => events.push('mouseup'))
    target.addEventListener('click', () => events.push('click'))

    fireEvent.touchStart(target, {
      touches: [touchPoint(24, 32)],
      changedTouches: [touchPoint(24, 32)],
    })
    fireEvent.touchEnd(target, {
      touches: [],
      changedTouches: [touchPoint(24, 32)],
    })

    expect(events).toEqual(['mousedown', 'mouseup', 'click'])
  })

  it('converts a touch drag into mouse selection events without emitting a click', () => {
    const events: string[] = []
    const { getByTestId } = render(
      <div data-testid="terminal-host">
        <div data-testid="terminal-screen" className="xterm-screen" />
        <TerminalTouchMouseOverlay sessionId="term-2" />
      </div>
    )

    const target = getByTestId('terminal-screen')
    mockElementFromPoint(target)

    target.addEventListener('mousedown', () => events.push('mousedown'))
    target.addEventListener('mousemove', (event) => {
      if ((event as MouseEvent).buttons === 1) {
        events.push('mousemove:drag')
      }
    })
    target.addEventListener('mouseup', () => events.push('mouseup'))
    target.addEventListener('click', () => events.push('click'))

    fireEvent.touchStart(target, {
      touches: [touchPoint(10, 20)],
      changedTouches: [touchPoint(10, 20)],
    })
    fireEvent.touchMove(target, {
      touches: [touchPoint(30, 44)],
      changedTouches: [touchPoint(30, 44)],
    })
    fireEvent.touchEnd(target, {
      touches: [],
      changedTouches: [touchPoint(30, 44)],
    })

    expect(events).toEqual(['mousedown', 'mousemove:drag', 'mouseup'])
  })
})
