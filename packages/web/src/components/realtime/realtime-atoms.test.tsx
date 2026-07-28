/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove RealtimeProjectionRoot publishes data-state/data-authority/data-cause and no layout chrome.
 * 2. Prove async actions/regions preserve command and content semantics without borrowing the stale-data veil.
 * 3. Prove RealtimeProgress renders indeterminate for unknown totals and determinate only for known.
 * 4. Prove the accessible status mirrors the topology for reduced-motion / screen readers.
 * 5. Prove the retained-content cue supplies hidden status and can preserve child DOM identity.
 *
 * Original request (2026-07-23): "保持命令标签不变（Save 仍为 Save）。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): "你说的组件化封装是必要的。"
 * Evidence type: unit (focused Vitest lane). Mutation-resistance: remove the label/activity/progress branch.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { deriveProjectionState } from '@/lib/realtime'
import {
  AsyncAction,
  AsyncActivityRegion,
  RealtimeAccessibleStatus,
  RealtimeProgress,
  RealtimeProjectionRoot,
  RealtimeRevalidateCue,
} from './index'

describe('AsyncActivityRegion', () => {
  it('announces local activity without marking its content as stale', () => {
    const view = render(
      <AsyncActivityRegion active statusLabel="saving settings">
        <span>settings</span>
      </AsyncActivityRegion>
    )

    expect(view.container.firstElementChild).toHaveAttribute('aria-busy', 'true')
    expect(view.container.querySelector('[role="status"]')).toHaveTextContent('saving settings')
    expect(view.container.querySelector('.rt-revalidate-cue')).toBeNull()
    expect(screen.getByText('settings')).toBeTruthy()
  })
})

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
    const { container } = render(
      <AsyncAction pending={false} settled={true}>
        Save
      </AsyncAction>
    )
    const button = container.querySelector('button') as HTMLButtonElement
    expect(button).not.toBeNull()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(button).toHaveAttribute('data-activity', 'true')
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
    const view = render(<RealtimeAccessibleStatus state={state} />)
    const status = view.container.querySelector('[role="status"]')
    expect(status).toHaveTextContent('updating')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveAttribute('aria-atomic', 'true')
  })
})

describe('RealtimeRevalidateCue', () => {
  it('keeps retained content visible and supplies a hidden accessible update state', () => {
    const { container } = render(
      <RealtimeRevalidateCue>
        <span>retained</span>
      </RealtimeRevalidateCue>
    )

    expect(screen.getByText('retained')).toBeTruthy()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('updating')
    expect(container.querySelector('.rt-revalidate-cue')).toHaveAttribute('aria-busy', 'true')
  })

  it('preserves a stateful child DOM node when a persistent cue settles', () => {
    const view = render(
      <RealtimeRevalidateCue active persistent>
        <textarea aria-label="draft" />
      </RealtimeRevalidateCue>
    )
    const draft = screen.getByLabelText('draft')

    view.rerender(
      <RealtimeRevalidateCue active={false} persistent>
        <textarea aria-label="draft" />
      </RealtimeRevalidateCue>
    )

    expect(screen.getByLabelText('draft')).toBe(draft)
    expect(view.container.querySelector('.rt-revalidate-cue')).toBeNull()
    expect(view.container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('keeps the live region and retained child mounted when a nonpersistent cue activates', () => {
    const view = render(
      <RealtimeRevalidateCue active={false}>
        <textarea aria-label="retained draft" />
      </RealtimeRevalidateCue>
    )
    const status = view.container.querySelector('.sr-only')
    const draft = screen.getByLabelText('retained draft')

    expect(status).not.toBeNull()
    expect(status).not.toHaveAttribute('role')

    view.rerender(
      <RealtimeRevalidateCue active>
        <textarea aria-label="retained draft" />
      </RealtimeRevalidateCue>
    )

    expect(view.container.querySelector('.sr-only')).toBe(status)
    expect(view.container.querySelector('[role="status"]')).toHaveTextContent('updating')
    expect(screen.getByLabelText('retained draft')).toBe(draft)
    expect(view.container.querySelector('.rt-revalidate-cue')).toHaveAttribute('aria-busy', 'true')
  })
})
