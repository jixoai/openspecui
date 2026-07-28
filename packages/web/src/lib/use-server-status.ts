/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Project current Server metadata from the reactive system subscription.
 * 2. Derive Live authority from the current WebSocket lifecycle and system emission.
 * 3. Preserve reconnect countdown and explicit manual recovery behavior.
 *
 * Owner-reported defect (2026-07-22): Killing the backend leaves the bottom status bar green and Live.
 */
import type { ProjectRecoveryStatus } from '@openspecui/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isStaticMode } from './static-mode'
import { getOrCreateWsClientInstance, trpcClient, WS_RETRY_DELAY_MS } from './trpc'

export interface ServerStatus {
  connected: boolean
  projectDir: string | null
  dirName: string | null
  watcherEnabled: boolean
  projectRecovery: ProjectRecoveryStatus
  error: string | null
  /** WebSocket 连接状态 */
  wsState: 'idle' | 'connecting' | 'pending'
  /** 重连倒计时（秒），仅在 disconnected 时有值 */
  reconnectCountdown: number | null
}

/**
 * Hook to monitor server connection status and get project info
 */
export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({
    connected: false,
    projectDir: null,
    dirName: null,
    watcherEnabled: false,
    projectRecovery: { state: 'idle' },
    error: null,
    wsState: 'idle',
    reconnectCountdown: null,
  })

  // 用于追踪重连倒计时
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disconnectTimeRef = useRef<number | null>(null)
  const wsStateRef = useRef<ServerStatus['wsState']>('idle')
  const systemGenerationRef = useRef(0)
  const activeSystemGenerationRef = useRef<number | null>(null)
  const systemSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // 开始重连倒计时
  const startReconnectCountdown = useCallback(() => {
    disconnectTimeRef.current = Date.now()

    // 清除之前的倒计时
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }

    // 立即设置初始倒计时
    setStatus((prev) => ({
      ...prev,
      reconnectCountdown: Math.ceil(WS_RETRY_DELAY_MS / 1000),
    }))

    // 每秒更新倒计时
    countdownRef.current = setInterval(() => {
      if (disconnectTimeRef.current === null) return

      const elapsed = Date.now() - disconnectTimeRef.current
      const remaining = Math.max(0, Math.ceil((WS_RETRY_DELAY_MS - elapsed) / 1000))

      setStatus((prev) => ({
        ...prev,
        reconnectCountdown: remaining > 0 ? remaining : null,
      }))

      // 倒计时结束时清除 interval
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
        disconnectTimeRef.current = null
      }
    }, 200)
  }, [])

  // 停止重连倒计时
  const stopReconnectCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    disconnectTimeRef.current = null
    setStatus((prev) => ({ ...prev, reconnectCountdown: null }))
  }, [])

  // WebSocket lifecycle owns admission to the system projection. A reconnect gets a new local generation.
  useEffect(() => {
    // Skip WebSocket monitoring in static mode
    if (isStaticMode()) {
      return
    }

    const wsClient = getOrCreateWsClientInstance()

    const retireSystemSubscription = () => {
      activeSystemGenerationRef.current = null
      systemGenerationRef.current += 1
      systemSubscriptionRef.current?.unsubscribe()
      systemSubscriptionRef.current = null
    }

    const beginSystemSubscription = () => {
      const generation = systemGenerationRef.current + 1
      systemGenerationRef.current = generation
      activeSystemGenerationRef.current = generation
      const isCurrentGeneration = () => activeSystemGenerationRef.current === generation

      systemSubscriptionRef.current = trpcClient.system.subscribe.subscribe(undefined, {
        onData: (data) => {
          if (!isCurrentGeneration()) {
            return
          }

          const projectDir = data.projectDir
          const dirName = projectDir.split('/').pop() || projectDir
          const connected = wsStateRef.current === 'pending'

          setStatus((prev) => ({
            ...prev,
            connected,
            projectDir,
            dirName,
            watcherEnabled: data.watcherEnabled,
            projectRecovery: data.projectRecovery,
            error: connected ? null : prev.error,
          }))

          document.title = `${dirName} - OpenSpec UI`
        },
        onError: (error) => {
          if (!isCurrentGeneration()) {
            return
          }

          setStatus((prev) => ({
            ...prev,
            connected: false,
            error: error.message,
          }))
          document.title = 'OpenSpec UI (Disconnected)'
        },
      })
    }

    if (!wsClient) {
      beginSystemSubscription()
      return retireSystemSubscription
    }

    const subscription = wsClient.connectionState.subscribe({
      next: (state) => {
        const previousWsState = wsStateRef.current
        wsStateRef.current = state.state

        if (state.state !== 'pending') {
          retireSystemSubscription()
        }

        setStatus((prev) => ({
          ...prev,
          connected:
            state.state === 'pending' && previousWsState === 'pending' ? prev.connected : false,
          wsState: state.state,
        }))

        if (state.state === 'pending' && previousWsState !== 'pending') {
          beginSystemSubscription()
        }

        // 当进入 connecting 状态且有 error 时，说明正在重连
        if (state.state === 'connecting' && state.error) {
          startReconnectCountdown()
        } else {
          stopReconnectCountdown()
        }
      },
    })

    return () => {
      subscription.unsubscribe()
      retireSystemSubscription()
      stopReconnectCountdown()
    }
  }, [startReconnectCountdown, stopReconnectCountdown])

  // Static exports have no live transport or system subscription.
  useEffect(() => {
    if (isStaticMode()) {
      setStatus((prev) => ({
        ...prev,
        connected: true,
        projectDir: 'Static Export',
        dirName: 'Static Export',
        watcherEnabled: false,
        projectRecovery: { state: 'idle' },
        error: null,
      }))
      document.title = 'OpenSpec UI (Static)'
      return undefined
    }
  }, [])

  return status
}

/**
 * 手动触发重连（通过重新创建 subscription 来间接触发）
 * 注意：由于 trpc wsClient 的 API 限制，无法直接调用重连
 * 这是一个 best-effort 的实现
 */
export function useManualReconnect() {
  // trpc wsClient 不暴露直接的重连 API
  // 但可以通过 queryClient.invalidateQueries 触发重新订阅
  return useCallback(() => {
    // 刷新页面是最可靠的重连方式
    window.location.reload()
  }, [])
}
