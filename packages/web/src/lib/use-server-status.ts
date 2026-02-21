import { useCallback, useEffect, useRef, useState } from 'react'
import { isStaticMode } from './static-mode'
import { trpcClient, getOrCreateWsClientInstance, WS_RETRY_DELAY_MS } from './trpc'

export interface ServerStatus {
  connected: boolean
  projectDir: string | null
  dirName: string | null
  watcherEnabled: boolean
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
    error: null,
    wsState: 'idle',
    reconnectCountdown: null,
  })

  // 用于追踪重连倒计时
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disconnectTimeRef = useRef<number | null>(null)

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

  // 监听 WebSocket 连接状态
  useEffect(() => {
    // Skip WebSocket monitoring in static mode
    if (isStaticMode()) {
      return
    }

    const wsClient = getOrCreateWsClientInstance()
    if (!wsClient) {
      return
    }

    // 订阅 wsClient 的连接状态
    const subscription = wsClient.connectionState.subscribe({
      next: (state) => {
        setStatus((prev) => ({
          ...prev,
          wsState: state.state,
        }))

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
      stopReconnectCountdown()
    }
  }, [startReconnectCountdown, stopReconnectCountdown])

  // 系统状态订阅（WS-first）
  useEffect(() => {
    if (isStaticMode()) {
      setStatus((prev) => ({
        ...prev,
        connected: true,
        projectDir: 'Static Export',
        dirName: 'Static Export',
        watcherEnabled: false,
        error: null,
      }))
      document.title = 'OpenSpec UI (Static)'
      return
    }

    const subscription = trpcClient.system.subscribe.subscribe(undefined, {
      onData: (data) => {
        const projectDir = data.projectDir
        const dirName = projectDir.split('/').pop() || projectDir

        setStatus((prev) => ({
          ...prev,
          connected: true,
          projectDir,
          dirName,
          watcherEnabled: data.watcherEnabled,
          error: null,
        }))

        document.title = `${dirName} - OpenSpec UI`
      },
      onError: (error) => {
        setStatus((prev) => ({
          ...prev,
          connected: false,
          error: error.message,
        }))
        document.title = 'OpenSpec UI (Disconnected)'
      },
    })

    return () => {
      subscription.unsubscribe()
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
