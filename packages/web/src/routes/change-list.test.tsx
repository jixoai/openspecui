import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
}))

describe('ChangeList', () => {
  beforeEach(() => {
    useChangesSubscriptionMock.mockReset()
    useOpsxStatusListSubscriptionMock.mockReset()
    navControllerMock.activatePop.mockReset()
  })

  it('renders task progress immediately even when opsx status is still loading', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'chat-channel-token-admin',
          name: 'chat-channel-token-admin',
          progress: { total: 9, completed: 0 },
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

  it('does not label artifact-complete but task-incomplete changes as ready to archive', () => {
    useChangesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: 'chat-channel-token-admin',
          name: 'chat-channel-token-admin',
          progress: { total: 9, completed: 0 },
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
    expect(screen.queryByText('Ready to Archive')).toBeNull()
    expect(screen.getByText('4/4 artifacts · spec-driven')).toBeTruthy()
  })
})
