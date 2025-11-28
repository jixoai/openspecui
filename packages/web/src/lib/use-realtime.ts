import { useEffect, useRef } from 'react'
import { trpcClient, queryClient } from './trpc'

type FileChangeType = 'spec' | 'change' | 'archive' | 'project'

interface FileChangeEvent {
  type: FileChangeType
  action: 'create' | 'update' | 'delete'
  id?: string
  path: string
  timestamp: number
}

/**
 * Hook to subscribe to all file changes and invalidate relevant queries
 */
export function useRealtimeUpdates() {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    // Subscribe to file changes
    const subscription = trpcClient.realtime.onFileChange.subscribe(undefined, {
      onData: (event) => {
        const e = event as FileChangeEvent
        // Invalidate relevant queries based on event type
        switch (e.type) {
          case 'spec':
            queryClient.invalidateQueries({ queryKey: ['spec'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            break
          case 'change':
          case 'archive':
            queryClient.invalidateQueries({ queryKey: ['change'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            break
          case 'project':
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            break
        }
      },
      onError: (err: unknown) => {
        console.error('Realtime subscription error:', err)
      },
    })

    subscriptionRef.current = subscription

    return () => {
      subscription.unsubscribe()
    }
  }, [])
}

/**
 * Hook to subscribe to spec changes for a specific spec
 */
export function useSpecRealtimeUpdates(specId?: string) {
  useEffect(() => {
    if (!specId) return

    const subscription = trpcClient.realtime.onSpecChange.subscribe(
      { specId },
      {
        onData: () => {
          // Invalidate all spec-related queries
          queryClient.invalidateQueries({ queryKey: ['spec', 'get', { id: specId }] })
          queryClient.invalidateQueries({ queryKey: ['spec', 'getRaw', { id: specId }] })
          queryClient.invalidateQueries({ queryKey: ['spec', 'validate', { id: specId }] })
          // Also invalidate list and dashboard for consistency
          queryClient.invalidateQueries({ queryKey: ['spec', 'list'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
        onError: (err: unknown) => {
          console.error('Spec realtime subscription error:', err)
        },
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [specId])
}

/**
 * Hook to subscribe to change proposal changes for a specific change
 */
export function useChangeRealtimeUpdates(changeId?: string) {
  useEffect(() => {
    if (!changeId) return

    const subscription = trpcClient.realtime.onChangeChange.subscribe(
      { changeId },
      {
        onData: () => {
          // Invalidate all change-related queries
          queryClient.invalidateQueries({ queryKey: ['change', 'get', { id: changeId }] })
          queryClient.invalidateQueries({ queryKey: ['change', 'getRaw', { id: changeId }] })
          queryClient.invalidateQueries({ queryKey: ['change', 'validate', { id: changeId }] })
          // Also invalidate list and dashboard for consistency
          queryClient.invalidateQueries({ queryKey: ['change', 'list'] })
          queryClient.invalidateQueries({ queryKey: ['change', 'listArchived'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        },
        onError: (err: unknown) => {
          console.error('Change realtime subscription error:', err)
        },
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [changeId])
}
