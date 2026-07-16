/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Prove Changes render formal tracked-task progress before Status arrives.
 * 2. Prove no-tasks and incomplete tasks cannot become workflow-complete.
 * 3. Prove completed tracked tasks and CLI Status converge on workflow completion.
 *
 * Original request (2026-07-15): "0/0 means no-tasks, never complete."
 */
import { cleanup, render, screen } from '@testing-library/react'
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

vi.mock('@/lib/nav-controller', () => ({
  navController: navControllerMock,
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
    useOpsxStatusListSubscriptionMock.mockReturnValue({ data: undefined })

    const { container } = render(<ChangeList />)

    expect(screen.getByText('chat-channel-token-admin')).toBeTruthy()
    expect(screen.getByText('0/9')).toBeTruthy()
    expect(screen.getByText('0% task completion')).toBeTruthy()
    expect(screen.getByText('Loading workflow status…')).toBeTruthy()
    expect(container.querySelector('[style="width: 0%;"]')).toBeTruthy()
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
          isComplete: true,
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
          isComplete: true,
          applyRequires: [],
          artifacts: [{ id: 'plan', status: 'done' }],
        },
      ],
    })

    render(<ChangeList />)

    expect(screen.getByText('0/0')).toBeTruthy()
    expect(screen.getByText('No Tracked Tasks')).toBeTruthy()
    expect(screen.getByText('No tracked tasks')).toBeTruthy()
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
          isComplete: true,
          applyRequires: ['tasks'],
          artifacts: [{ id: 'tasks', status: 'done' }],
        },
      ],
    })

    render(<ChangeList />)

    expect(screen.getByText('Workflow Complete')).toBeTruthy()
    expect(screen.getByText('2/2')).toBeTruthy()
    expect(screen.getByText('100% task completion')).toBeTruthy()
    expect(screen.queryByText(/archive-ready|ready to archive/i)).toBeNull()
  })
})
