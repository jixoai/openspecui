/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Subscribe to Planning-root Dashboard overview and Git task status.
 * 2. Execute Dashboard Git mutations against the stable Launch-owned Code binding.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git bindings.
 */
import type { DashboardOverview } from '@openspecui/core'
import { useCallback } from 'react'
import * as StaticProvider from './static-data-provider'
import { isStaticMode } from './static-mode'
import { trpcClient } from './trpc'
import { useSubscription, type SubscriptionState } from './use-subscription'

async function getCodeGitBindingToken(): Promise<string> {
  return (await trpcClient.git.code.query()).bindingToken
}

/** Subscribe to the current Planning-owned Dashboard projection. */
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

/** Observable status for background Dashboard Git snapshot work. */
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

/** Subscribe to Dashboard Git snapshot task lifecycle. */
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

/** Refresh Launch-owned Code Git and request a current Dashboard projection update. */
export async function refreshDashboardGitSnapshot(reason: string): Promise<void> {
  if (isStaticMode()) return
  const expectedBindingToken = await getCodeGitBindingToken()
  await trpcClient.dashboard.refreshGitSnapshot.mutate({
    scope: 'code',
    expectedBindingToken,
    reason,
  })
}

/** Remove one detached Code worktree through the current backend-issued Code binding. */
export async function removeDetachedDashboardWorktree(path: string): Promise<void> {
  if (isStaticMode()) return
  const expectedBindingToken = await getCodeGitBindingToken()
  await trpcClient.dashboard.removeDetachedWorktree.mutate({
    scope: 'code',
    expectedBindingToken,
    path,
  })
}
