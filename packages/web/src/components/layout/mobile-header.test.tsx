import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileHeader } from './mobile-header'

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-dark-mode', () => ({
  useDarkMode: () => false,
}))

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: () => ({
    connected: true,
    watcherEnabled: true,
    dirName: 'openspecui',
    reconnectCountdown: null,
  }),
  useManualReconnect: () => vi.fn(),
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => ({
    mainTabs: ['/dashboard', '/settings'],
    bottomTabs: ['/git', '/terminal'],
    mainLocation: { pathname: '/dashboard' },
    bottomLocation: { pathname: '/terminal' },
    popLocation: { pathname: '/' },
    bottomActive: true,
    popActive: false,
  }),
}))

vi.mock('@/lib/notifications/context', () => ({
  useNotifications: () => ({
    unreadCount: 2,
    openPanel: vi.fn(),
  }),
}))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  vtNavController: {
    activatePop: vi.fn(),
  },
}))

describe('MobileHeader', () => {
  afterEach(() => cleanup())

  it('places notifications next to search and renders live status as icon-only', () => {
    render(<MobileHeader />)

    expect(screen.getByRole('button', { name: 'Open search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open notifications, 2 unread' })).toBeTruthy()
    expect(screen.queryByText('Live')).toBeNull()
  })
})
