/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Prove one current system emission can establish live Server metadata.
 * 2. Prove reconnecting transport lifecycle retires stale connected truth.
 *
 * Owner-reported defect (2026-07-22): Killing the backend leaves the bottom status bar green and Live.
 */
import type { ProjectRecoveryStatus } from '@openspecui/core'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

const idleRecovery: ProjectRecoveryStatus = { state: 'idle' }

const modeState = vi.hoisted(() => ({ staticMode: false }))
const observerRef = vi.hoisted<{ observer: ConnectionObserver | null }>(() => ({ observer: null }))
const systemHandlersRef = vi.hoisted<{ handlers: SystemHandlers | null }>(() => ({
  handlers: null,
}))
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
    systemHandlersRef.handlers = null
    vi.clearAllMocks()
  })

  it('retires a prior system emission while its WebSocket transport reconnects', async () => {
    getOrCreateWsClientInstanceMock.mockReturnValue({
      connectionState: {
        subscribe: (observer: ConnectionObserver) => {
          observerRef.observer = observer
          return { unsubscribe: vi.fn() }
        },
      },
    })

    systemSubscribeMock.mockImplementation((_input: undefined, handlers: SystemHandlers) => {
      systemHandlersRef.handlers = handlers
      return { unsubscribe: vi.fn() }
    })

    const { useServerStatus } = await import('./use-server-status')
    const { result, unmount } = renderHook(() => useServerStatus())

    act(() => {
      observerRef.observer?.next({ state: 'pending' })
      systemHandlersRef.handlers?.onData({
        projectDir: '/tmp/opsx-project',
        watcherEnabled: true,
        projectRecovery: idleRecovery,
      })
    })

    await waitFor(() => {
      expect(result.current).toMatchObject({
        connected: true,
        dirName: 'opsx-project',
        wsState: 'pending',
      })
    })

    act(() => {
      observerRef.observer?.next({
        state: 'connecting',
        error: new Error('reconnecting'),
      })
    })

    await waitFor(() => {
      expect(result.current.wsState).toBe('connecting')
      expect(result.current.connected).toBe(false)
      expect(result.current.projectDir).toBe('/tmp/opsx-project')
      expect(result.current.reconnectCountdown).not.toBeNull()
    })

    act(() => {
      observerRef.observer?.next({ state: 'pending' })
    })

    await waitFor(() => {
      expect(result.current.wsState).toBe('pending')
      expect(result.current.connected).toBe(false)
    })

    act(() => {
      systemHandlersRef.handlers?.onData({
        projectDir: '/tmp/opsx-project',
        watcherEnabled: true,
        projectRecovery: idleRecovery,
      })
    })

    await waitFor(() => {
      expect(result.current.connected).toBe(true)
    })

    act(() => {
      observerRef.observer?.next({ state: 'idle' })
    })

    await waitFor(() => {
      expect(result.current.wsState).toBe('idle')
      expect(result.current.connected).toBe(false)
    })

    unmount()
  })
})
