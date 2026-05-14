import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from './notification-settings'

const { previewSoundMock, requestBrowserPermissionMock, useNotificationsMock } = vi.hoisted(() => ({
  previewSoundMock: vi.fn(),
  requestBrowserPermissionMock: vi.fn(),
  useNotificationsMock: vi.fn(),
}))

vi.mock('@/lib/notifications/context', () => ({
  useNotifications: () => useNotificationsMock(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    sounds: {
      listCustom: {
        queryOptions: () => ({
          queryKey: ['sounds.listCustom'],
          queryFn: async () => [],
        }),
      },
    },
  },
  trpcClient: {
    config: {
      update: {
        mutate: vi.fn().mockResolvedValue({}),
      },
    },
    sounds: {
      renameCustom: {
        mutate: vi.fn().mockResolvedValue({}),
      },
      deleteCustom: {
        mutate: vi.fn().mockResolvedValue({}),
      },
    },
  },
}))

function renderSettings(systemNotificationsEnabled: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationSettings
        sound="builtin:Blow"
        volume={1}
        systemNotificationsEnabled={systemNotificationsEnabled}
      />
    </QueryClientProvider>
  )
}

describe('NotificationSettings', () => {
  beforeEach(() => {
    requestBrowserPermissionMock.mockReset()
    previewSoundMock.mockReset()
    useNotificationsMock.mockReturnValue({
      browserSupported: true,
      browserPermission: 'granted',
      requestBrowserPermission: requestBrowserPermissionMock,
      previewSound: previewSoundMock,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders enabled system notifications as an activity button', () => {
    renderSettings(true)

    const button = screen.getByRole('button', { name: 'Enabled' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(button)

    expect(requestBrowserPermissionMock).not.toHaveBeenCalled()
  })

  it('keeps request permission actionable when notifications are not enabled', () => {
    renderSettings(false)

    fireEvent.click(screen.getByRole('button', { name: 'Request permission' }))

    expect(requestBrowserPermissionMock).toHaveBeenCalledTimes(1)
  })
})
