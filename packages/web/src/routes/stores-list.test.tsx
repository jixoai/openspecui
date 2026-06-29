import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoresList } from './stores-list'

const storesListDataMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    stores: {
      list: {
        // TanStack Query 的 queryOptions() 调用：返回一个带 queryKey/queryFn 的对象。
        queryOptions: () => ({
          queryKey: ['stores', 'list'],
          queryFn: () => storesListDataMock(),
        }),
      },
    },
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn }: { queryFn: () => unknown }) => {
    try {
      const data = queryFn()
      return { data, isLoading: false, isFetching: false, refetch: vi.fn() }
    } catch {
      return { data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() }
    }
  },
}))

describe('StoresList (beta fault-tolerance)', () => {
  beforeEach(() => {
    storesListDataMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the list and Beta badge when stores are available', () => {
    storesListDataMock.mockReturnValue({
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
    storesListDataMock.mockReturnValue({
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
    storesListDataMock.mockReturnValue({
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
    storesListDataMock.mockReturnValue({ available: true, stores: [] })

    render(<StoresList />)

    expect(screen.getByText(/No stores registered/)).toBeInTheDocument()
  })
})
