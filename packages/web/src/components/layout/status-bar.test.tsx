import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopStatusBar } from './status-bar'

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('@/lib/use-server-status', () => ({
  useServerStatus: () => ({
    connected: true,
    watcherEnabled: true,
    projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/openspecui',
    reconnectCountdown: null,
  }),
  useManualReconnect: () => vi.fn(),
}))

vi.mock('@/lib/notifications/context', () => ({
  useNotifications: () => ({
    unreadCount: 1,
    openPanel: vi.fn(),
  }),
}))

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

describe('DesktopStatusBar', () => {
  afterEach(() => cleanup())

  it('uses the shared top-layer entry style for notifications', () => {
    render(<DesktopStatusBar />)

    const notificationButton = screen.getByRole('button', {
      name: 'Open notifications, 1 unread',
    })

    expect(notificationButton.className).toContain('top-layer-entry-button')
    expect(notificationButton.className).toContain('border-primary')
    expect(notificationButton.className).toContain('h-7.5')
    expect(notificationButton.className).toContain('w-7.5')
    expect(notificationButton.className).toContain('p-0')
    expect(notificationButton.className).not.toContain('px-2')
    expect(notificationButton.querySelector('svg')?.className.baseVal).toContain('h-4')
    expect(notificationButton.querySelector('svg')?.className.baseVal).toContain('w-4')
  })
})
