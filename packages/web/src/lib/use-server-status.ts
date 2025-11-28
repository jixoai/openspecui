import { useEffect, useState } from 'react'
import { getHealthUrl } from './api-config'

export interface ServerStatus {
  connected: boolean
  projectDir: string | null
  dirName: string | null
  watcherEnabled: boolean
  error: string | null
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
  })

  useEffect(() => {
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

          setStatus({
            connected: true,
            projectDir,
            dirName,
            watcherEnabled: data.watcherEnabled,
            error: null,
          })

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
