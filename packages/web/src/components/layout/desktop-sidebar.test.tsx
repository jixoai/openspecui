/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify the desktop sidebar remains accessible in expanded and collapsed layouts.
 * 2. Verify project Context remains reachable while retired Stores entries cannot render.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Original request (2026-07-28): make Planning identity primary while Launch remains accessible.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopSidebar } from './desktop-sidebar'

const { activatePopMock } = vi.hoisted(() => ({
  activatePopMock: vi.fn(),
}))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-dark-mode', () => ({
  useDarkMode: () => false,
}))

vi.mock('@/lib/use-context-subscription', () => ({
  useContextSubscription: () => ({
    data: {
      state: 'ready',
      data: {
        launchProject: { path: '/workspace/launch-app' },
        planningRoot: { path: '/stores/planning-root', source: 'store' },
        storeId: 'shared',
      },
    },
    isLoading: false,
    error: null,
  }),
  selectRootContextSnapshot: (state: { data?: unknown }) => state?.data ?? null,
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => ({
    mainTabs: ['/dashboard', '/config', '/context', '/stores', '/settings'],
    bottomTabs: ['/git', '/terminal'],
    mainLocation: {
      href: '/dashboard',
      pathname: '/dashboard',
      search: '',
      hash: '',
      state: { __TSR_index: 0, key: 'main', __TSR_key: 'main' },
    },
    bottomLocation: {
      href: '/git',
      pathname: '/git',
      search: '',
      hash: '',
      state: { __TSR_index: 0, key: 'bottom', __TSR_key: 'bottom' },
    },
    popLocation: {
      href: '/',
      pathname: '/',
      search: '',
      hash: '',
      state: { __TSR_index: 0, key: 'pop', __TSR_key: 'pop' },
    },
    bottomActive: true,
    popActive: false,
  }),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    moveTab: vi.fn(),
    reorder: vi.fn(),
    mainTabs: ['/dashboard', '/config', '/settings'],
    bottomTabs: ['/git', '/terminal'],
  },
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  vtNavController: {
    activatePop: activatePopMock,
    activateBottom: vi.fn(),
    deactivateBottom: vi.fn(),
  },
}))

describe('DesktopSidebar', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('collapses to icon-only navigation and keeps controls accessible', () => {
    const { container } = render(<DesktopSidebar />)

    expect(screen.getByAltText('OpenSpec')).toBeTruthy()
    const expandedSearchButton = screen.getByRole('button', { name: 'Search' })
    expect(screen.getByText('Search')).toBeTruthy()
    expect(screen.getByText('planning-root')).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'Open Root Context. Launch: launch-app. Planning: planning-root.',
      })
    ).toBeTruthy()
    expect(expandedSearchButton.className).toContain('justify-start')
    expect(expandedSearchButton.className).not.toContain('justify-center')
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Context')).toBeTruthy()
    expect(screen.queryByText('Stores')).toBeNull()
    expect(screen.getByText('Bottom')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.queryByAltText('OpenSpec')).toBeNull()
    expect(screen.queryByText('Search')).toBeNull()
    expect(screen.queryByText('launch-app')).toBeNull()
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('Context')).toBeNull()
    expect(screen.queryByText('Stores')).toBeNull()
    expect(screen.queryByText('Bottom')).toBeNull()

    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'Open Root Context. Launch: launch-app. Planning: planning-root.',
      })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Context' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Stores' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Git' })).toBeTruthy()

    for (const item of container.querySelectorAll('li')) {
      expect(item.getAttribute('draggable')).toBe('false')
    }
  })

  it('keeps search activation available while collapsed', () => {
    const { container } = render(<DesktopSidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    fireEvent.click(within(container).getByRole('button', { name: 'Search' }))

    expect(activatePopMock).toHaveBeenCalledWith('/search')
  })
})
