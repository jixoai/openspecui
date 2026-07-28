/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Verify Archive copy and rows stay scoped to the writable Planning root projection.
 * 2. Verify the Planning-root empty state does not imply environment-wide completeness.
 * 3. Prove resolved and unknown Archive data render their real first-frame topology before effects.
 * 4. Prove no-data and retained-data transport errors remain visible without false success claims.
 * 5. Prove retained rows and empty snapshots expose Updating without false settled claims.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveList } from './archive-list'

const useArchivesSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-subscription', () => ({
  useArchivesSubscription: useArchivesSubscriptionMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    state: _state,
    vt: _vt,
    children,
    ...props
  }: {
    to: string
    params?: { changeId?: string }
    state?: unknown
    vt?: unknown
    children?: ReactNode
  } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to.replace('$changeId', params?.changeId ?? '')} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

describe('ArchiveList', () => {
  beforeEach(() => {
    useArchivesSubscriptionMock.mockReset()
  })

  afterEach(() => cleanup())

  it('renders resolved Archive data before effects', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-22-resolved',
          name: 'Resolved archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: null,
    })

    const markup = renderToStaticMarkup(<ArchiveList />)

    expect(markup).toContain('Resolved archive')
    expect(markup).toContain('/archive/2026-07-22-resolved')
    expect(markup).not.toContain('Loading archived changes...')
  })

  it('renders the real unknown-data Loading state before effects as a stable skeleton', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const markup = renderToStaticMarkup(<ArchiveList />)

    // The initial-loading topology is now a visual skeleton (luminance language) rather than routine
    // "Loading..." copy, while page chrome (the header) stays mounted so navigation does not flash.
    expect(markup).toContain('Archive')
    expect(markup).toContain('rt-skeleton')
    expect(markup).not.toContain('Loading archived changes...')
  })

  it('renders a no-data Archive error without a blank list frame', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Archive subscription disconnected.'),
    })

    const markup = renderToStaticMarkup(<ArchiveList />)
    const root = document.createElement('div')
    root.innerHTML = markup
    const alert = root.querySelector('[role="alert"]')

    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain('Archive subscription disconnected.')
    expect(markup).not.toContain('Loading archived changes...')
    expect(markup).not.toContain('No archived changes yet.')
    expect(root.querySelector('a')).toBeNull()
    expect(root.querySelector('.divide-y')).toBeNull()
  })

  it('renders a retained-data Archive error beside the stale row', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-22-retained',
          name: 'Retained archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: new Error('Archive reconnect failed.'),
    })

    const markup = renderToStaticMarkup(<ArchiveList />)
    const root = document.createElement('div')
    root.innerHTML = markup
    const alert = root.querySelector('[role="alert"]')

    expect(markup).toContain('Retained archive')
    expect(markup).toContain('/archive/2026-07-22-retained')
    expect(markup).not.toContain('No archived changes yet.')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain('Archive reconnect failed.')
  })

  it('renders Updating beside retained rows during a live recompute', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-22-updating',
          name: 'Updating archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    render(<ArchiveList />)

    expect(screen.getByRole('status')).toHaveTextContent('updating')
    expect(screen.getByText('Updating archive')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Updating archive/i }).getAttribute('href')).toBe(
      '/archive/2026-07-22-updating'
    )
    expect(screen.queryByText('Loading archived changes...')).toBeNull()
    expect(screen.queryByText('No archived changes yet.')).toBeNull()
  })

  it('does not claim a retained empty snapshot is settled during a live recompute', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      isUpdating: true,
      error: null,
    })

    render(<ArchiveList />)

    expect(screen.getByRole('status')).toHaveTextContent('updating')
    expect(screen.queryByText('No archived changes yet.')).toBeNull()
    expect(screen.queryByText(/Changes in this Planning root are archived/i)).toBeNull()
  })

  it('does not render Updating for a resolved static projection', () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-22-static',
          name: 'Static archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      isUpdating: false,
      error: null,
    })

    render(<ArchiveList />)

    expect(screen.getByText('Static archive')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Updating')).toBeNull()
  })

  it('renders only rows supplied by the writable Planning-root subscription', async () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-16-planning-only',
          name: 'Planning-only archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: null,
    })

    render(<ArchiveList />)

    await waitFor(() => expect(screen.getByText('Planning-only archive')).toBeTruthy())
    expect(screen.getByText(/current writable Planning root/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Planning-only archive/i }).getAttribute('href')).toBe(
      '/archive/2026-07-16-planning-only'
    )
  })

  it('attributes an empty list to this Planning root', async () => {
    useArchivesSubscriptionMock.mockReturnValue({ data: [], isLoading: false, error: null })

    render(<ArchiveList />)

    await waitFor(() => expect(screen.getByText('No archived changes yet.')).toBeTruthy())
    expect(screen.getByText(/Changes in this Planning root are archived/i)).toBeTruthy()
  })
})
