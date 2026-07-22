/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Preserve the shared top-layer notification entry contract.
 * 2. Project connected and disconnected Server status through distinct text, color, and icons.
 *
 * Owner-reported defect (2026-07-22): Killing the backend leaves the bottom status bar green and Live.
 */
import type { ProjectRecoveryStatus } from '@openspecui/core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopStatusBar, StatusIndicator } from './status-bar'

type ConnectionState = {
  state: 'idle' | 'connecting' | 'pending'
  error?: Error
}

type ConnectionObserver = {
  next: (state: ConnectionState) => void
}

type SystemHandlers = {
  onData: (data: {
    projectDir: string
    watcherEnabled: boolean
    projectRecovery: ProjectRecoveryStatus
  }) => void
  onError: (error: Error) => void
}

type SystemSubscription = {
  unsubscribe: () => void
}

const observerRef = vi.hoisted<{ observer: ConnectionObserver | null }>(() => ({ observer: null }))
const systemHandlersRef = vi.hoisted<{ handlers: SystemHandlers[] }>(() => ({
  handlers: [],
}))
const systemSubscriptionsRef = vi.hoisted<{ subscriptions: SystemSubscription[] }>(() => ({
  subscriptions: [],
}))
const getOrCreateWsClientInstanceMock = vi.hoisted(() => vi.fn())
const systemSubscribeMock = vi.hoisted(() => vi.fn())
const idleRecovery: ProjectRecoveryStatus = { state: 'idle' }

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
  getBasePath: () => '/',
}))

vi.mock('@/lib/trpc', () => ({
  WS_RETRY_DELAY_MS: 3000,
  getOrCreateWsClientInstance: getOrCreateWsClientInstanceMock,
  trpcClient: {
    system: {
      subscribe: {
        subscribe: systemSubscribeMock,
      },
    },
  },
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

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return {
    ...actual,
    Link2: ({ className }: { className?: string }) => (
      <svg data-testid="live-link-icon" className={className} />
    ),
    Unlink2: ({ className }: { className?: string }) => (
      <svg data-testid="offline-unlink-icon" className={className} />
    ),
  }
})

describe('DesktopStatusBar', () => {
  afterEach(() => {
    observerRef.observer = null
    systemHandlersRef.handlers = []
    systemSubscriptionsRef.subscriptions = []
    vi.clearAllMocks()
    cleanup()
  })

  function setupTransportMocks(): void {
    getOrCreateWsClientInstanceMock.mockReturnValue({
      connectionState: {
        subscribe: (observer: ConnectionObserver) => {
          observerRef.observer = observer
          return { unsubscribe: vi.fn() }
        },
      },
    })
    systemSubscribeMock.mockImplementation((_input: undefined, handlers: SystemHandlers) => {
      systemHandlersRef.handlers.push(handlers)
      const subscription = { unsubscribe: vi.fn() }
      systemSubscriptionsRef.subscriptions.push(subscription)
      return subscription
    })
  }

  it('uses the shared top-layer entry style for notifications', () => {
    setupTransportMocks()
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

  it('replaces the Live link with the Offline unlink when transport truth is retired', () => {
    setupTransportMocks()
    render(<StatusIndicator />)

    act(() => {
      observerRef.observer?.next({ state: 'pending' })
      systemHandlersRef.handlers[0]?.onData({
        projectDir: '/Users/kzf/Dev/GitHub/jixoai-labs/openspecui',
        watcherEnabled: true,
        projectRecovery: idleRecovery,
      })
    })

    return waitFor(() => {
      expect(screen.getByText('Live')).toHaveClass('text-green-600')
      expect(screen.getByTestId('live-link-icon')).toHaveClass('text-green-500')
    })
      .then(() => {
        act(() => {
          observerRef.observer?.next({
            state: 'connecting',
            error: new Error('backend closed'),
          })
        })

        return waitFor(() => {
          expect(screen.getByText('Offline')).toHaveClass('text-red-600')
          expect(screen.queryByTestId('live-link-icon')).toBeNull()
          expect(screen.getByTestId('offline-unlink-icon')).toHaveClass('text-red-500')
          expect(systemSubscriptionsRef.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
        })
      })
      .then(() => {
        act(() => {
          observerRef.observer?.next({ state: 'pending' })
          systemHandlersRef.handlers[0]?.onData({
            projectDir: '/tmp/late-a',
            watcherEnabled: true,
            projectRecovery: idleRecovery,
          })
        })

        return waitFor(() => {
          expect(screen.getByText('Offline')).toHaveClass('text-red-600')
          expect(screen.queryByTestId('live-link-icon')).toBeNull()
          expect(screen.getByTestId('offline-unlink-icon')).toHaveClass('text-red-500')
          expect(systemHandlersRef.handlers).toHaveLength(2)
        })
      })
      .then(() => {
        act(() => {
          systemHandlersRef.handlers[1]?.onData({
            projectDir: '/tmp/current-b',
            watcherEnabled: true,
            projectRecovery: idleRecovery,
          })
        })

        return waitFor(() => {
          expect(screen.getByText('Live')).toHaveClass('text-green-600')
          expect(screen.getByTestId('live-link-icon')).toHaveClass('text-green-500')
        })
      })
  })
})
