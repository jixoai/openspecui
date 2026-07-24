/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Join one Store Inspector locator to the shared mutation ledger and settlement composer.
 * 2. Render active, recent terminal, and connection evidence without inventing lifecycle state.
 * 3. Register locator-scoped HTTP admissions for first-snapshot settlement correlation.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useConnectionObservationOwner } from '../lib/connection-observation'
import { useMutationObservations } from '../lib/mutation-observation-provider'
import {
  createStoreLifecycleComposer,
  projectStoreLifecycle,
  selectStoreMutationLocator,
  type StoreLifecycleProjection,
} from '../lib/store-lifecycle-composer'
import { useConnections } from '../lib/use-connections'
import { MutationStatusBadge } from './mutation-status'

/** Compose terminal-driven Store/Context pulls for one normalized Inspector locator. */
export function useStoreMutationLifecycle(
  apiBaseUrl: string | null | undefined,
  refreshStore: () => void | Promise<void>
): StoreLifecycleProjection & { registerAdmission(apiBaseUrl: string, requestId: string): void } {
  const mutationSnapshot = useMutationObservations()
  const connections = useConnections()
  const connectionOwner = useConnectionObservationOwner()
  const refreshStoreRef = useRef(refreshStore)
  refreshStoreRef.current = refreshStore
  const connectionOwnerRef = useRef(connectionOwner)
  connectionOwnerRef.current = connectionOwner
  const [composer] = useState(() =>
    createStoreLifecycleComposer({
      refreshStore: () => refreshStoreRef.current(),
      refreshContexts: (tabIds) => connectionOwnerRef.current.refresh(tabIds),
    })
  )
  const locator = selectStoreMutationLocator(mutationSnapshot, apiBaseUrl)

  useLayoutEffect(() => {
    composer.setLocator(apiBaseUrl)
    return () => composer.setLocator(null)
  }, [apiBaseUrl, composer])

  useEffect(() => {
    composer.observe(locator, connections.tabs)
  }, [composer, connections.tabs, locator, mutationSnapshot.revision])

  return {
    ...projectStoreLifecycle(locator),
    registerAdmission: composer.registerAdmission,
  }
}

/** Render backend-owned Store mutation and transport evidence without operation controls. */
export function StoreMutationLifecycleEvidence({
  lifecycle,
}: {
  lifecycle: StoreLifecycleProjection
}) {
  const { locator, active, recent } = lifecycle
  if (!locator && active.length === 0 && recent.length === 0) return null

  return (
    <section
      className="border-border space-y-3 border-t pt-4"
      aria-label="Store mutation lifecycle"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Mutation lifecycle</h2>
        <span
          className={`text-xs ${locator?.current ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}
        >
          {locator?.lifecycle ?? 'unavailable'}
        </span>
      </header>
      {locator?.error ? (
        <p className="border-destructive/40 text-destructive rounded border px-2 py-1 text-xs">
          {locator.error}
        </p>
      ) : null}
      {active.length > 0 ? <MutationRecordList label="Active operations" records={active} /> : null}
      {recent.length > 0 ? (
        <MutationRecordList label="Recent settlements" records={recent} />
      ) : null}
    </section>
  )
}

function MutationRecordList({
  label,
  records,
}: {
  label: string
  records: StoreLifecycleProjection['active']
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-muted-foreground text-xs font-medium">{label}</h3>
      <ul className="divide-border divide-y text-xs">
        {records.map((record) => (
          <li key={record.requestId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-medium">{record.kind}</span>
              <span className="text-muted-foreground block truncate font-mono">
                {record.storeId ?? record.requestId}
              </span>
            </span>
            <MutationStatusBadge status={record.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}
