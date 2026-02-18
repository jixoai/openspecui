import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchRoute } from './search'

const navControllerMock = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  deactivatePop: vi.fn(),
  getAreaForPath: vi.fn<(path: string) => 'main' | 'bottom' | 'pop'>(),
}))
const popAreaConfigMock = vi.hoisted(() => ({
  setConfig: vi.fn(),
  resetConfig: vi.fn(),
}))
const popAreaLifecycleMock = vi.hoisted(() => ({
  requestClose: vi.fn(),
  closeRequestVersion: 0,
}))

const useSearchMock = vi.hoisted(() => vi.fn())
const useLocationMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/nav-controller', () => ({
  navController: navControllerMock,
}))

vi.mock('@/lib/use-search', () => ({
  useSearch: useSearchMock,
}))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => popAreaConfigMock,
  usePopAreaLifecycleContext: () => popAreaLifecycleMock,
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: useLocationMock,
}))

describe('SearchRoute', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    navControllerMock.replace.mockReset()
    navControllerMock.push.mockReset()
    navControllerMock.deactivatePop.mockReset()
    navControllerMock.getAreaForPath.mockReset()
    popAreaConfigMock.setConfig.mockReset()
    popAreaConfigMock.resetConfig.mockReset()
    popAreaLifecycleMock.requestClose.mockReset()
    useSearchMock.mockReset()
    useLocationMock.mockReset()
  })

  it('routes result click to owning area and closes pop', () => {
    useLocationMock.mockReturnValue({
      search: '?query=auth',
      state: null,
    })
    useSearchMock.mockReturnValue({
      data: [
        {
          documentId: 'change:add-auth',
          kind: 'change',
          title: 'Add Auth',
          href: '/changes/add-auth',
          path: 'openspec/changes/add-auth',
          score: 100,
          snippet: 'Auth change',
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: null,
    })
    navControllerMock.getAreaForPath.mockReturnValue('bottom')

    render(<SearchRoute />)

    fireEvent.click(screen.getByRole('button', { name: /Add Auth/i }))

    expect(navControllerMock.getAreaForPath).toHaveBeenCalledWith('/changes/add-auth')
    expect(navControllerMock.push).toHaveBeenCalledWith('bottom', '/changes/add-auth', null)
    expect(popAreaLifecycleMock.requestClose).toHaveBeenCalledTimes(1)
  })

  it('syncs input query to pop route via replace', () => {
    useLocationMock.mockReturnValue({
      search: '',
      state: { from: 'search-test' },
    })
    useSearchMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)

    fireEvent.change(screen.getByPlaceholderText('Search specs, changes, archive...'), {
      target: { value: 'api auth' },
    })

    expect(navControllerMock.replace).toHaveBeenCalledWith(
      'pop',
      '/search?query=api+auth',
      { from: 'search-test' }
    )
  })

  it('highlights matched terms in result text', () => {
    useLocationMock.mockReturnValue({
      search: '?query=auth',
      state: null,
    })
    useSearchMock.mockReturnValue({
      data: [
        {
          documentId: 'spec:auth',
          kind: 'spec',
          title: 'Auth Flow',
          href: '/specs/auth',
          path: 'openspec/specs/auth/spec.md',
          score: 100,
          snippet: 'Authentication requirement',
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: null,
    })
    navControllerMock.getAreaForPath.mockReturnValue('main')

    render(<SearchRoute />)

    expect(screen.getAllByText('Auth').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Auth')[0]?.tagName).toBe('MARK')
  })
})
