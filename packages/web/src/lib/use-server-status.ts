import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealthUrl } from './api-config'
import { isStaticMode } from './static-mode'
import { getWsClientInstance, WS_RETRY_DELAY_MS } from './trpc'

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

    const wsClient = getWsClientInstance()
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

  // HTTP 健康检查逻辑
  useEffect(() => {
    // Skip health checks in static mode
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

    let mounted = true
    let retryTimeout: ReturnType<typeof setTimeout>

    async function checkHealth() {
      try {
        const response = await fetch(getHealthUrl())
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()

        if (mounted) {
          const projectDir = data.projectDir as string
          const dirName = projectDir.split('/').pop() || projectDir

          setStatus((prev) => ({
            ...prev,
            connected: true,
            projectDir,
            dirName,
            watcherEnabled: data.watcherEnabled,
            error: null,
          }))

          // Update document title
          document.title = `${dirName} - OpenSpec UI`
        }
      } catch (err) {
        if (mounted) {
          setStatus((prev) => ({
            ...prev,
            connected: false,
            error: err instanceof Error ? err.message : 'Connection failed',
          }))

          // Reset title on disconnect
          document.title = 'OpenSpec UI (Disconnected)'

          // Retry after 3 seconds
          retryTimeout = setTimeout(checkHealth, 3000)
        }
      }
    }

    checkHealth()

    // Periodic health check every 30 seconds when connected
    const interval = setInterval(() => {
      if (mounted) {
        checkHealth()
      }
    }, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
      clearTimeout(retryTimeout)
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
