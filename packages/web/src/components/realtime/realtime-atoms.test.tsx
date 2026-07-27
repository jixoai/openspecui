/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove RealtimeProjectionRoot publishes data-state/data-authority/data-cause and no layout chrome.
 * 2. Prove AsyncAction keeps the command label unchanged while pending (aria-busy + activity lock).
 * 3. Prove RealtimeProgress renders indeterminate for unknown totals and determinate only for known.
 * 4. Prove the accessible status mirrors the topology for reduced-motion / screen readers.
 *
 * Original request (2026-07-23): "保持命令标签不变（Save 仍为 Save）。"
 * Evidence type: unit (focused Vitest lane). Mutation-resistance: remove the label/activity/progress branch.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { deriveProjectionState } from '@/lib/realtime'
import {
  AsyncAction,
  RealtimeAccessibleStatus,
  RealtimeProgress,
  RealtimeProjectionRoot,
} from './index'

describe('RealtimeProjectionRoot', () => {
  it('publishes data-state/data-authority/data-cause with no Card/border/page-wrapper', () => {
    const state = deriveProjectionState<string[]>({
      data: ['a'],
      isLoading: false,
      isUpdating: false,
      error: null,
      authority: 'current',
      cause: 'initial',
      progress: null,
    })
    const { container } = render(
      <RealtimeProjectionRoot state={state}>
        <span>content</span>
      </RealtimeProjectionRoot>
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-state')).toBe('current')
    expect(root.getAttribute('data-authority')).toBe('current')
    expect(root.getAttribute('data-cause')).toBe('initial')
    // No imposed layout chrome: it is a plain div carrying only the data attributes.
    expect(root.tagName).toBe('DIV')
  })

  it('reflects revalidating/display-only for retained content during reconnect', () => {
    const state = deriveProjectionState<string[]>({
      data: ['a'],
      isLoading: false,
      isUpdating: true,
      error: null,
      authority: 'current',
      cause: 'reconnect',
      progress: null,
    })
    const { container } = render(
      <RealtimeProjectionRoot state={state}>
        <span>content</span>
      </RealtimeProjectionRoot>
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-state')).toBe('revalidating')
    expect(root.getAttribute('data-authority')).toBe('display-only')
  })
})

describe('AsyncAction', () => {
  it('keeps the command label unchanged while pending', () => {
    render(<AsyncAction pending={true}>Save</AsyncAction>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    // The label is literally still "Save", not "Saving...".
    expect(screen.getByRole('button').textContent).toBe('Save')
  })

  it('does not set aria-busy when not pending', () => {
    const { container } = render(<AsyncAction pending={false}>Save</AsyncAction>)
    const button = container.querySelector('button') as HTMLButtonElement
    expect(button).not.toBeNull()
    expect(button).not.toHaveAttribute('aria-busy')
  })
})

describe('RealtimeProgress', () => {
  it('renders indeterminate for an unknown total (no fabricated percentage)', () => {
    const { container } = render(<RealtimeProgress progress={{ completed: 3, total: 'unknown' }} />)
    const bar = container.querySelector('.rt-progress-indeterminate')
    expect(bar).not.toBeNull()
    expect(container.querySelector('.rt-progress-fill')).toBeNull()
  })

  it('renders a determinate fill for a known total', () => {
    const { container } = render(<RealtimeProgress progress={{ completed: 1, total: 4 }} />)
    const track = container.querySelector('.rt-progress-track')
    expect(track).not.toBeNull()
    const fill = container.querySelector('.rt-progress-fill') as HTMLElement
    expect(fill.style.inlineSize).toBe('25%')
  })

  it('renders nothing when progress is null', () => {
    const { container } = render(<RealtimeProgress progress={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('RealtimeAccessibleStatus', () => {
  it('mirrors the topology as a hidden live region', () => {
    const state = deriveProjectionState<string[]>({
      data: ['a'],
      isLoading: false,
      isUpdating: true,
      error: null,
      authority: 'current',
      cause: 'server-push',
      progress: null,
    })
    render(<RealtimeAccessibleStatus state={state} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('updating')
    expect(status).toHaveClass('rt-sr-status')
  })
})
