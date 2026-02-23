import type { DashboardOverview } from '@openspecui/core'
import { useCallback } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'
import { useSubscription, type SubscriptionState } from './use-subscription'

export function useDashboardOverviewSubscription(): SubscriptionState<DashboardOverview> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: DashboardOverview) => void; onError: (err: Error) => void }) =>
      trpcClient.dashboard.subscribe.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<DashboardOverview>(
    subscribe,
    StaticProvider.getDashboardOverview,
    [],
    'dashboard.subscribe'
  )
}

export interface DashboardGitTaskStatus {
  running: boolean
  inFlight: number
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastReason: string | null
  lastError: string | null
}

function getDefaultGitTaskStatus(): DashboardGitTaskStatus {
  return {
    running: false,
    inFlight: 0,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastReason: null,
    lastError: null,
  }
}

export function useDashboardGitTaskStatusSubscription(): SubscriptionState<DashboardGitTaskStatus> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: DashboardGitTaskStatus) => void
      onError: (err: Error) => void
    }) =>
      trpcClient.dashboard.subscribeGitTaskStatus.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<DashboardGitTaskStatus>(
    subscribe,
    async () => getDefaultGitTaskStatus(),
    [],
    'dashboard.subscribeGitTaskStatus'
  )
}

export async function refreshDashboardGitSnapshot(reason: string): Promise<void> {
  if (isStaticMode()) return
  await trpcClient.dashboard.refreshGitSnapshot.mutate({ reason })
}
