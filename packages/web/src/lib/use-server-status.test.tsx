import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

type ConnectionState = {
  state: 'idle' | 'connecting' | 'pending'
  error?: Error
}

type ConnectionObserver = {
  next: (state: ConnectionState) => void
}

const modeState = vi.hoisted(() => ({ staticMode: false }))
const observerRef = vi.hoisted(() => ({ observer: null as ConnectionObserver | null }))
const getOrCreateWsClientInstanceMock = vi.hoisted(() => vi.fn())
const systemSubscribeMock = vi.hoisted(() => vi.fn())

vi.mock('./static-mode', () => ({
  isStaticMode: () => modeState.staticMode,
}))

vi.mock('./trpc', () => ({
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

describe('useServerStatus', () => {
  afterEach(() => {
    modeState.staticMode = false
    observerRef.observer = null
    vi.clearAllMocks()
  })

  it('subscribes connection state even when ws client is not pre-created', async () => {
    getOrCreateWsClientInstanceMock.mockReturnValue({
      connectionState: {
        subscribe: (observer: ConnectionObserver) => {
          observerRef.observer = observer
          return { unsubscribe: vi.fn() }
        },
      },
    })

    systemSubscribeMock.mockImplementation(
      (
        _input: undefined,
        handlers: { onData: (data: { projectDir: string; watcherEnabled: boolean }) => void }
      ) => {
        handlers.onData({
          projectDir: '/tmp/opsx-project',
          watcherEnabled: true,
        })
        return { unsubscribe: vi.fn() }
      }
    )

    const { useServerStatus } = await import('./use-server-status')
    const { result } = renderHook(() => useServerStatus())

    await waitFor(() => {
      expect(result.current.connected).toBe(true)
      expect(result.current.dirName).toBe('opsx-project')
    })

    expect(getOrCreateWsClientInstanceMock).toHaveBeenCalled()
    expect(observerRef.observer).not.toBeNull()

    observerRef.observer?.next({
      state: 'connecting',
      error: new Error('reconnecting'),
    })

    await waitFor(() => {
      expect(result.current.wsState).toBe('connecting')
      expect(result.current.reconnectCountdown).not.toBeNull()
    })
  })
})
