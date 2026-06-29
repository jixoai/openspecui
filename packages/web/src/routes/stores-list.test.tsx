import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoresList } from './stores-list'

const useStoresSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-subscription', () => ({
  // 数据由 server 端轮询并推送；测试直接控制订阅返回的数据。
  useStoresSubscription: useStoresSubscriptionMock,
}))

function mockSubscription(data: unknown) {
  useStoresSubscriptionMock.mockReturnValue({ data, isLoading: data === undefined })
}

describe('StoresList (beta fault-tolerance)', () => {
  beforeEach(() => {
    useStoresSubscriptionMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the list and Beta badge when stores are available', () => {
    mockSubscription({
      available: true,
      stores: [{ id: 'team', root: '/repo/team' }],
    })

    render(<StoresList />)

    expect(screen.getByText('Stores')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('team')).toBeInTheDocument()
    expect(screen.getByText('/repo/team')).toBeInTheDocument()
  })

  it('renders an objective error with version source on data-incompatible (异常一)', () => {
    mockSubscription({
      available: false,
      stores: [],
      error: {
        kind: 'data-incompatible',
        message: 'boom',
        cliVersion: '1.5.0',
      },
      cliVersion: '1.5.0',
    })

    render(<StoresList />)

    expect(screen.getByText('Stores data is incompatible')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    // 版本信息非常重要——必须显示。
    expect(screen.getByText(/1\.5\.0/)).toBeInTheDocument()
  })

  it('renders a minimal unavailable notice on command-unavailable (异常二)', () => {
    mockSubscription({
      available: false,
      stores: [],
      error: {
        kind: 'command-unavailable',
        message: 'no such command',
        cliVersion: '1.4.0',
      },
      cliVersion: '1.4.0',
    })

    render(<StoresList />)

    // 入口正常会在 nav 层隐藏；这里只验证组件本身不崩溃并给出提示。
    expect(screen.getByText(/Stores are unavailable/)).toBeInTheDocument()
    expect(screen.queryByText('team')).not.toBeInTheDocument()
  })

  it('renders an empty state when no stores are registered', () => {
    mockSubscription({ available: true, stores: [] })

    render(<StoresList />)

    expect(screen.getByText(/No stores registered/)).toBeInTheDocument()
  })
})
