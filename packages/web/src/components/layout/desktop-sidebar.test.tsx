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

vi.mock('@/lib/use-stores-visibility', () => ({
  useStoresVisibility: () => ({ visible: true }),
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => ({
    mainTabs: ['/dashboard', '/config', '/settings'],
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
    expect(expandedSearchButton.className).toContain('justify-start')
    expect(expandedSearchButton.className).not.toContain('justify-center')
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Bottom')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.queryByAltText('OpenSpec')).toBeNull()
    expect(screen.queryByText('Search')).toBeNull()
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('Bottom')).toBeNull()

    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
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
