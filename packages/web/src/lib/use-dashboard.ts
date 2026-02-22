import type { DashboardOverview } from '@openspecui/core'
import { useCallback } from 'react'
import * as StaticProvider from './static-data-provider'
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
