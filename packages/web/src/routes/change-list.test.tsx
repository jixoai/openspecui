/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Prove Changes render a primary row before admitting the lower-priority aggregate Status projection.
 * 2. Prove no-tasks and incomplete tasks cannot become workflow-complete.
 * 3. Prove typed OpenSpec 1.7 Status and completed tracked tasks converge on workflow completion.
 * 4. Prove the page-level New command remains available with active Changes.
 * 5. Distinguish main Change-subscription terminal errors and stale refresh from Loading and empty truth.
 *
 * Original request (2026-07-15): "0/0 means no-tasks, never complete."
 * Original request (2026-07-21): "Changes页面的右上角没有 New,你要不要快速补一个"
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-08-01): OpenSpecUI 7 uses exact artifact dependency fixtures.

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeList } from './change-list'

const useChangesSubscriptionMock = vi.hoisted(() => vi.fn())
const useOpsxStatusListSubscriptionMock = vi.hoisted(() => vi.fn())
const navControllerMock = vi.hoisted(() => ({
  activatePop: vi.fn(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useChangesSubscription: useChangesSubscriptionMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: useOpsxStatusListSubscriptionMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    children,
    state: _state,
    vt: _vt,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children?: ReactNode
    state?: unknown
    vt?: unknown
  } & Omit<ComponentProps<'a'>, 'href'>) => {
    const href = Object.entries(params ?? {}).reduce(
      (path, [name, value]) => path.replace(`$${name}`, encodeURIComponent(value)),
      to
    )
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  vtNavController: navControllerMock,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({
    pathname: '/changes',
    search: '',
    hash: '',
    state: null,
  }),
  useNavigate: () => vi.fn(),
}))

describe('ChangeList', () => {
  beforeEach(() => {
    useChangesSubscriptionMock.mockReset()
    useOpsxStatusListSubscriptionMock.mockReset()
    navControllerMock.activatePop.mockReset()
  })

  afterEach(() => cleanup())

  it('opens the advanced New Change form from the page header with active Changes', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'existing-change',
          name: 'existing-change',
          trackedTaskProgress: { total: 1, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<ChangeList />)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(navControllerMock.activatePop).toHaveBeenCalledWith('/opsx-new')
  })

  it('renders task progress immediately even when opsx status is still loading', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'chat-channel-token-admin',
          name: 'chat-channel-token-admin',
          trackedTaskProgress: { total: 9, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now() - 60_000,
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByText('chat-channel-token-admin')).toBeTruthy()
    // The list never claims implementation completion: no task counts, no percent bar, no
    // completion copy derived from tracked data without Apply Instructions.
    expect(screen.queryByText('0/9')).toBeNull()
    expect(screen.queryByText('0% task completion')).toBeNull()
    expect(container.querySelector('[style="width: 0%;"]')).toBeNull()
    expect(screen.getByText('Planning status pending CLI status')).toBeTruthy()
    expect(container.querySelector('.rt-skeleton-line')).not.toBeNull()
    expect(screen.queryByText('Loading workflow status…')).toBeNull()
  })

  it('admits aggregate workflow Status only after the first Change row is renderable', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const view = render(<ChangeList />)

    expect(useOpsxStatusListSubscriptionMock).toHaveBeenLastCalledWith(false)

    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'first-renderable-change',
          name: 'First renderable change',
          trackedTaskProgress: { total: 1, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
      error: null,
    })
    view.rerender(<ChangeList />)

    expect(screen.getByText('First renderable change')).toBeTruthy()
    expect(useOpsxStatusListSubscriptionMock).toHaveBeenLastCalledWith(true)
  })

  it('renders explicit batch progress with an unknown total without inventing a percentage', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'first-progressive-change',
          name: 'First progressive change',
          trackedTaskProgress: { total: 1, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
      error: null,
      rowErrors: [],
      progress: { completed: 1, total: 'unknown' },
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<ChangeList />)

    expect(screen.getByText('Loaded 1/unknown changes')).toBeTruthy()
  })

  it('keeps retained rows visible and labels their revalidation instead of returning to Loading', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'stale-change',
          name: 'Stale Change',
          trackedTaskProgress: { total: 1, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
      isUpdating: true,
      error: null,
      rowErrors: [],
      progress: null,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByText('Stale Change')).toBeTruthy()
    expect(container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('updating')
    expect(screen.queryByText('Refreshing changes...')).toBeNull()
    expect(screen.queryByText('Loading changes...')).toBeNull()
  })

  it('renders a terminal workflow Status error without hiding Change progress', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'status-error-change',
          name: 'status-error-change',
          trackedTaskProgress: { total: 4, completed: 1, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('status failed'),
    })

    render(<ChangeList />)

    expect(screen.getByText('status-error-change')).toBeTruthy()
    expect(screen.queryByText('1/4')).toBeNull()
    expect(screen.queryByText('25% task completion')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('status failed')
    expect(screen.getByText('Workflow status unavailable')).toBeTruthy()
    expect(screen.queryByText('Loading workflow status…')).toBeNull()
  })

  it('renders unavailable when the current Status list has no matching Change', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'status-unavailable-change',
          name: 'status-unavailable-change',
          trackedTaskProgress: { total: 3, completed: 2, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    render(<ChangeList />)

    expect(screen.getByText('Workflow status unavailable')).toBeTruthy()
    expect(screen.queryByText('Loading workflow status…')).toBeNull()
  })

  it('renders a terminal main Change error without an empty list frame', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('changes failed'),
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByRole('heading', { name: 'Changes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('changes failed')
    expect(screen.queryByText('Loading changes...')).toBeNull()
    expect(screen.queryByText('No active changes.')).toBeNull()
    expect(container.querySelector('.divide-y')).toBeNull()
  })

  it('keeps retained Changes and current Status evidence visible beside a main error', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'main-error-change',
          name: 'Main Error Change',
          trackedTaskProgress: { total: 4, completed: 2, phase: 'in-progress' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
      error: new Error('changes failed'),
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [
        {
          changeName: 'main-error-change',
          schemaName: 'spec-driven',
          isPlanningComplete: false,
          applyRequires: ['tasks'],
          artifacts: [
            { id: 'proposal', status: 'done' },
            { id: 'tasks', status: 'in-progress' },
          ],
        },
      ],
      isLoading: false,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByRole('alert').textContent).toContain('changes failed')
    expect(screen.getByText('Main Error Change')).toBeTruthy()
    // Tracked counts no longer surface as implementation progress.
    expect(screen.queryByText('2/4')).toBeNull()
    expect(screen.queryByText('50% task completion')).toBeNull()
    expect(container.querySelector('[style="width: 50%;"]')).toBeNull()
    expect(container.querySelector('a[href="/changes/main-error-change"]')).toBeTruthy()
    expect(screen.getByText('1/2 artifacts · spec-driven')).toBeTruthy()
    expect(screen.queryByText('Loading changes...')).toBeNull()
    expect(screen.queryByText('No active changes.')).toBeNull()
  })

  it('does not classify an empty retained Change list as active-empty during a main error', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('changes failed'),
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByRole('alert').textContent).toContain('changes failed')
    expect(screen.queryByText('Loading changes...')).toBeNull()
    expect(screen.queryByText('No active changes.')).toBeNull()
    expect(container.querySelector('.divide-y')).toBeNull()
  })

  it('keeps the current empty Change list, Header New, and Propose commands available', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    const { container } = render(<ChangeList />)

    expect(screen.getByText('No active changes.')).toBeTruthy()
    expect(container.querySelector('.divide-y')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Propose' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open advanced /opsx:new form' })).toBeTruthy()
  })

  it('does not label artifact-complete but task-incomplete changes as complete', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'chat-channel-token-admin',
          name: 'chat-channel-token-admin',
          trackedTaskProgress: { total: 9, completed: 0, phase: 'in-progress' },
          updatedAt: Date.now() - 60_000,
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [
        {
          changeName: 'chat-channel-token-admin',
          schemaName: 'spec-driven',
          isPlanningComplete: true,
          applyRequires: ['tasks'],
          artifacts: [
            { id: 'proposal', status: 'done' },
            { id: 'design', status: 'done' },
            { id: 'specs', status: 'done' },
            { id: 'tasks', status: 'done' },
          ],
        },
      ],
    })

    render(<ChangeList />)

    expect(screen.getByText('In Execution')).toBeTruthy()
    expect(screen.queryByText('Workflow Complete')).toBeNull()
    expect(screen.getByText('4/4 artifacts · spec-driven')).toBeTruthy()
  })

  it('keeps 0/0 no-tasks distinct from complete', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'no-tracked-tasks',
          name: 'no-tracked-tasks',
          trackedTaskProgress: { total: 0, completed: 0, phase: 'no-tasks' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [
        {
          changeName: 'no-tracked-tasks',
          schemaName: 'custom',
          isPlanningComplete: true,
          applyRequires: [],
          artifacts: [{ id: 'plan', status: 'done', requires: [] }],
        },
      ],
    })

    render(<ChangeList />)

    // No-tasks stays an objective planning fact without task-count surfaces.
    expect(screen.queryByText('0/0')).toBeNull()
    expect(screen.getByText('No Tracked Tasks')).toBeTruthy()
    expect(screen.queryByText('No tracked tasks')).toBeNull()
    expect(screen.queryByText('0% task completion')).toBeNull()
    expect(screen.queryByText('Workflow Complete')).toBeNull()
  })

  it('labels a CLI-complete change complete only when tracked tasks are complete', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'completed-change',
          name: 'completed-change',
          trackedTaskProgress: { total: 2, completed: 2, phase: 'complete' },
          updatedAt: Date.now(),
        },
      ],
      isLoading: false,
    })
    useOpsxStatusListSubscriptionMock.mockReturnValue({
      data: [
        {
          changeName: 'completed-change',
          schemaName: 'spec-driven',
          isPlanningComplete: true,
          applyRequires: ['tasks'],
          artifacts: [{ id: 'tasks', status: 'done', requires: [] }],
        },
      ],
    })

    render(<ChangeList />)

    expect(screen.getByText('Workflow Complete')).toBeTruthy()
    // Completion copy stays objective: no tracked count or percent claims.
    expect(screen.queryByText('2/2')).toBeNull()
    expect(screen.queryByText('100% task completion')).toBeNull()
    expect(screen.queryByText(/archive-ready|ready to archive/i)).toBeNull()
  })
})
