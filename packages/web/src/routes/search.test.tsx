/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify Search result navigation, highlighting, and pop-area lifecycle.
 * 2. Verify URL-defaulted source tabs preserve query and compound Reference navigation.
 * 3. Verify source-correct empty, loading, and error states remain mutually exclusive.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
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
      scope: 'active-root',
      data: [
        {
          documentId: 'change:add-auth',
          kind: 'change',
          scope: 'active-root',
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
      scope: 'active-root',
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)

    fireEvent.change(screen.getByPlaceholderText('Search Owned Specs, Changes, and Archives...'), {
      target: { value: 'api auth' },
    })

    expect(navControllerMock.replace).toHaveBeenCalledWith('pop', '/search?query=api+auth', {
      from: 'search-test',
    })
  })

  it('highlights matched terms in result text', () => {
    useLocationMock.mockReturnValue({
      search: '?query=auth',
      state: null,
    })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [
        {
          documentId: 'spec:owned:auth',
          kind: 'spec',
          scope: 'active-root',
          title: 'Auth Flow',
          href: '/specs/owned/auth',
          path: 'owned:openspec/specs/auth/spec.md',
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

  it('defaults invalid source parameters to Active root', () => {
    useLocationMock.mockReturnValue({
      search: '?query=auth&scope=unknown',
      state: null,
    })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)

    expect(screen.getByRole('tab', { name: 'Active root' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(useSearchMock).toHaveBeenCalledWith('auth', 'active-root')
  })

  it('preserves the query when selecting Referenced Specs', () => {
    useLocationMock.mockReturnValue({
      search: '?query=api+auth',
      state: { from: 'search-test' },
    })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)
    fireEvent.click(screen.getByRole('tab', { name: 'Referenced Specs' }))

    expect(navControllerMock.replace).toHaveBeenCalledWith(
      'pop',
      '/search?query=api+auth&scope=referenced-specs',
      { from: 'search-test' }
    )
    expect(useSearchMock).toHaveBeenLastCalledWith('api auth', 'referenced-specs')
  })

  it('renders the Active-root empty state without a result list', () => {
    useLocationMock.mockReturnValue({ search: '?query=missing', state: null })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)

    expect(screen.getByText(/No matching results in the active Planning root/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders the Referenced empty state with neutral observed-only copy', () => {
    useLocationMock.mockReturnValue({
      search: '?query=missing&scope=referenced-specs',
      state: null,
    })
    useSearchMock.mockReturnValue({
      scope: 'referenced-specs',
      data: [],
      isLoading: false,
      error: null,
    })

    render(<SearchRoute />)

    expect(screen.getByText(/No matching Referenced Specs currently observed/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders loading without stale results or an empty-state claim', () => {
    useLocationMock.mockReturnValue({ search: '?query=auth', state: null })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [
        {
          documentId: 'change:stale-auth',
          kind: 'change',
          scope: 'active-root',
          title: 'Stale Auth',
          href: '/changes/stale-auth',
          path: 'openspec/changes/stale-auth',
          score: 1,
          snippet: 'stale',
          updatedAt: 1,
        },
      ],
      isLoading: true,
      error: null,
    })

    render(<SearchRoute />)

    expect(screen.getByText('Searching...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stale Auth/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/No matching results/i)).not.toBeInTheDocument()
  })

  it('renders an error without stale results or an empty-state claim', () => {
    useLocationMock.mockReturnValue({ search: '?query=auth', state: null })
    useSearchMock.mockReturnValue({
      scope: 'active-root',
      data: [
        {
          documentId: 'spec:owned:stale-auth',
          kind: 'spec',
          scope: 'active-root',
          title: 'Stale Auth',
          href: '/specs/owned/stale-auth',
          path: 'owned:openspec/specs/stale-auth/spec.md',
          score: 1,
          snippet: 'stale',
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: new Error('Search unavailable'),
    })

    render(<SearchRoute />)

    expect(screen.getByText('Search unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stale Auth/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/No matching results/i)).not.toBeInTheDocument()
  })

  it('navigates a Store-qualified Referenced Spec and labels it read-only', () => {
    useLocationMock.mockReturnValue({
      search: '?query=auth&scope=referenced-specs',
      state: null,
    })
    useSearchMock.mockReturnValue({
      scope: 'referenced-specs',
      data: [
        {
          documentId: 'spec:referenced:platform-a:auth',
          kind: 'spec',
          scope: 'referenced-specs',
          title: 'Auth',
          href: '/specs/referenced/platform-a/auth',
          path: 'referenced:platform-a:specs/auth',
          score: 100,
          snippet: 'Authentication requirement',
          updatedAt: 0,
        },
      ],
      isLoading: false,
      error: null,
    })
    navControllerMock.getAreaForPath.mockReturnValue('main')

    render(<SearchRoute />)
    fireEvent.click(screen.getByRole('button', { name: /Auth/i }))

    expect(screen.getByText(/read-only spec/i)).toBeInTheDocument()
    expect(navControllerMock.getAreaForPath).toHaveBeenCalledWith(
      '/specs/referenced/platform-a/auth'
    )
    expect(navControllerMock.push).toHaveBeenCalledWith(
      'main',
      '/specs/referenced/platform-a/auth',
      null
    )
  })
})
