/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Select one exact normalized locator's Store mutation ledger projection.
 * 2. Baseline terminal history and emit each later current terminal transition exactly once.
 * 3. Trigger Store and matching retained-tab Context pulls from terminal settlements only.
 * 4. Correlate HTTP-admitted request ids without treating admission as lifecycle evidence.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import type { MutationLocatorProjection, MutationObservationSnapshot } from './mutation-observation'
import type { HostedShellTab } from './shell-state'
import { normalizeHostedApiBaseUrl } from './shell-state'

const TERMINAL_STATUSES = new Set<StoreMutationEnvelope['status']>([
  'succeeded',
  'failed',
  'indeterminate',
])

/** Store lifecycle evidence rendered for one backend locator. */
export interface StoreLifecycleProjection {
  locator: MutationLocatorProjection | null
  active: readonly StoreMutationEnvelope[]
  recent: readonly StoreMutationEnvelope[]
}

interface StoreLifecycleComposerDependencies {
  refreshStore(): void | Promise<void>
  refreshContexts(tabIds: readonly string[]): void | Promise<void>
}

function consumeRefresh(refresh: () => void | Promise<void>): void {
  try {
    const pending = refresh()
    if (pending) void pending.catch(() => undefined)
  } catch {
    // Projection owners surface their own refresh errors; composition must not create an unhandled one.
  }
}

/** Select the mutation projection owned by one exact normalized backend locator. */
export function selectStoreMutationLocator(
  snapshot: MutationObservationSnapshot,
  apiBaseUrl: string | null | undefined
): MutationLocatorProjection | null {
  if (!apiBaseUrl) return null
  const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
  if (!normalized) return null
  return snapshot.projections.find((projection) => projection.apiBaseUrl === normalized) ?? null
}

/** Split retained ledger evidence without changing its backend-owned ordering or status. */
export function projectStoreLifecycle(
  locator: MutationLocatorProjection | null
): StoreLifecycleProjection {
  const records = locator?.records ?? []
  return {
    locator,
    active: records.filter(({ status }) => status === 'accepted' || status === 'running'),
    recent: records.filter(({ status }) => TERMINAL_STATUSES.has(status)),
  }
}

/**
 * Own terminal-edge bookkeeping for one mounted Store surface. The first current snapshot is historical
 * baseline; retained non-current evidence is display-only and cannot initiate pulls.
 */
export function createStoreLifecycleComposer(dependencies: StoreLifecycleComposerDependencies) {
  let locator: string | null = null
  let baselined = false
  const observedStatuses = new Map<string, StoreMutationEnvelope['status']>()
  const settledRequestIds = new Set<string>()
  const refreshedRequestIds = new Set<string>()
  const pendingAdmissions = new Set<string>()
  let lastCurrentRecords = new Map<string, StoreMutationEnvelope>()
  let lastCurrentTabs: readonly HostedShellTab[] = []
  let hasCurrentProjection = false

  const reset = (nextLocator: string | null): void => {
    locator = nextLocator
    baselined = false
    observedStatuses.clear()
    settledRequestIds.clear()
    refreshedRequestIds.clear()
    pendingAdmissions.clear()
    lastCurrentRecords = new Map()
    lastCurrentTabs = []
    hasCurrentProjection = false
  }

  const pullSettledProjection = (tabs: readonly HostedShellTab[]): void => {
    if (!locator) return
    const matchingTabIds = tabs.flatMap((tab) =>
      normalizeHostedApiBaseUrl(tab.apiBaseUrl) === locator ? [tab.id] : []
    )
    consumeRefresh(dependencies.refreshStore)
    consumeRefresh(() => dependencies.refreshContexts(matchingTabIds))
  }

  return {
    setLocator(apiBaseUrl: string | null | undefined): void {
      const normalized = apiBaseUrl ? normalizeHostedApiBaseUrl(apiBaseUrl) : null
      if (normalized === locator) return
      reset(normalized)
    },
    registerAdmission(apiBaseUrl: string, requestId: string): void {
      const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
      if (!normalized || normalized !== locator || requestId.length === 0) return
      if (refreshedRequestIds.has(requestId)) return
      const currentRecord = hasCurrentProjection ? lastCurrentRecords.get(requestId) : undefined
      if (currentRecord && TERMINAL_STATUSES.has(currentRecord.status)) {
        settledRequestIds.add(requestId)
        refreshedRequestIds.add(requestId)
        pullSettledProjection(lastCurrentTabs)
        return
      }
      pendingAdmissions.add(requestId)
    },
    observe(
      projection: MutationLocatorProjection | null,
      tabs: readonly HostedShellTab[]
    ): StoreLifecycleProjection {
      const view = projectStoreLifecycle(projection)
      if (projection?.apiBaseUrl === locator && !projection.current) {
        hasCurrentProjection = false
        lastCurrentRecords = new Map()
        lastCurrentTabs = []
      }
      if (!projection?.current || projection.apiBaseUrl !== locator) return view
      hasCurrentProjection = true
      lastCurrentRecords = new Map(projection.records.map((record) => [record.requestId, record]))
      lastCurrentTabs = [...tabs]

      if (!baselined) {
        baselined = true
        let settledPending = false
        for (const record of projection.records) {
          observedStatuses.set(record.requestId, record.status)
          if (!TERMINAL_STATUSES.has(record.status)) continue
          settledRequestIds.add(record.requestId)
          if (pendingAdmissions.delete(record.requestId)) {
            refreshedRequestIds.add(record.requestId)
            settledPending = true
          }
        }
        if (settledPending) pullSettledProjection(tabs)
        return view
      }

      const newlySettled: StoreMutationEnvelope[] = []
      for (const record of projection.records) {
        const previousStatus = observedStatuses.get(record.requestId)
        observedStatuses.set(record.requestId, record.status)
        if (!TERMINAL_STATUSES.has(record.status)) continue
        const pendingSettlement = pendingAdmissions.delete(record.requestId)
        const transitionedToTerminal =
          !TERMINAL_STATUSES.has(previousStatus ?? 'accepted') &&
          !settledRequestIds.has(record.requestId)
        if (
          !refreshedRequestIds.has(record.requestId) &&
          (pendingSettlement || transitionedToTerminal)
        ) {
          settledRequestIds.add(record.requestId)
          refreshedRequestIds.add(record.requestId)
          newlySettled.push(record)
        }
      }

      if (newlySettled.length > 0) {
        pullSettledProjection(tabs)
      }
      return view
    },
  }
}
