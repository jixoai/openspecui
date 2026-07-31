/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Own detail-only Specs and active-Changes Push-to-Pull projection lifecycles.
 * 2. Preserve each region independently across loading, retained refresh, failure, and recovery.
 * 3. Retire late completion when composite Store identity or source locator changes.
 *
 * Original request (2026-07-30): "StoreDetailPage应该如何设计呢？"
 * Spec: hosted-environment-delivery > "Environment-Scoped Store Content Projection".
 */
import type {
  HostedCliProjectionNotice,
  HostedStoreContentChangesProjectionState,
  HostedStoreContentSpecsProjectionState,
} from '@openspecui/core/hosted-contract'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createTRPCCliProjectionTransportFactory,
  type CliProjectionTransport,
} from './cli-projection-transport'
import { fetchBackendStoreContentProjection } from './store-content-transport'
import type { StoreDetailChangesRegion, StoreDetailSpecsRegion } from './store-detail-projection'

interface StoreContentDataOptions {
  readonly apiBaseUrl: string | null
  readonly envUri: string
  readonly storeId: string
  readonly supported: boolean
}

interface RegionalState<T> {
  readonly identity: string
  readonly value: T
}

interface RegionalError {
  readonly identity: string
  readonly message: string
}

/** Independent Store Detail content regions derived from one mounted composite identity. */
export interface StoreContentDataState {
  readonly specs: StoreDetailSpecsRegion
  readonly changes: StoreDetailChangesRegion
}

function projectionMatchesNotice(
  state: HostedStoreContentSpecsProjectionState | HostedStoreContentChangesProjectionState,
  notice: HostedCliProjectionNotice
): boolean {
  return (
    state.identity === notice.identity &&
    state.workGeneration === notice.workGeneration &&
    state.snapshotGeneration === notice.snapshotGeneration &&
    state.state === notice.state
  )
}

/** Project one Specs region while preserving retained entries and direct refresh errors. */
export function projectStoreSpecsRegion(
  state: HostedStoreContentSpecsProjectionState | undefined,
  error: string | undefined,
  supported: boolean
): StoreDetailSpecsRegion {
  if (!supported) return { state: 'error', error: 'Store Specs are not supported by this backend.' }
  const data = state?.data
  const projectionError = state?.error?.message
  if (!data) {
    const directError = error ?? projectionError
    return directError ? { state: 'error', error: directError } : { state: 'loading' }
  }
  const featureError = data.error?.message
  if (!data.available && featureError) return { state: 'error', error: featureError }
  const stateKind = data.specs.length === 0 ? 'empty' : 'ready'
  return {
    state: stateKind,
    entries: data.specs,
    refreshing: state?.state === 'revalidating',
    ...((error ?? projectionError) ? { error: error ?? projectionError } : {}),
  }
}

/** Project one active-Changes region independently from Specs settlement. */
export function projectStoreChangesRegion(
  state: HostedStoreContentChangesProjectionState | undefined,
  error: string | undefined,
  supported: boolean
): StoreDetailChangesRegion {
  if (!supported) {
    return { state: 'error', error: 'Store active Changes are not supported by this backend.' }
  }
  const data = state?.data
  const projectionError = state?.error?.message
  if (!data) {
    const directError = error ?? projectionError
    return directError ? { state: 'error', error: directError } : { state: 'loading' }
  }
  const featureError = data.error?.message
  if (!data.available && featureError) return { state: 'error', error: featureError }
  const stateKind = data.changes.length === 0 ? 'empty' : 'ready'
  return {
    state: stateKind,
    entries: data.changes,
    refreshing: state?.state === 'revalidating',
    ...((error ?? projectionError) ? { error: error ?? projectionError } : {}),
  }
}

/** Start Store-content work only while one Store Detail route is mounted. */
export function useStoreContentData(options: StoreContentDataOptions): StoreContentDataState {
  const { apiBaseUrl, envUri, storeId, supported } = options
  const identity = `${apiBaseUrl ?? ''}\u0000${envUri}\u0000${storeId}`
  const [specs, setSpecs] = useState<RegionalState<HostedStoreContentSpecsProjectionState>>()
  const [changes, setChanges] = useState<RegionalState<HostedStoreContentChangesProjectionState>>()
  const [specsError, setSpecsError] = useState<RegionalError>()
  const [changesError, setChangesError] = useState<RegionalError>()
  const epoch = useRef(0)
  const sequences = useRef({ specs: 0, changes: 0 })
  const latest = useRef<{
    specs: HostedStoreContentSpecsProjectionState | undefined
    changes: HostedStoreContentChangesProjectionState | undefined
  }>({ specs: undefined, changes: undefined })
  const transportFactory = useMemo(createTRPCCliProjectionTransportFactory, [])

  const pull = useCallback(
    async (
      kind: 'specs' | 'changes',
      expectedEpoch: number,
      notice?: HostedCliProjectionNotice
    ): Promise<void> => {
      if (!apiBaseUrl || !supported) return
      const sequence = ++sequences.current[kind]
      const isCurrent = () =>
        expectedEpoch === epoch.current && sequence === sequences.current[kind]
      try {
        if (kind === 'specs') {
          const value = await fetchBackendStoreContentProjection(
            { apiBaseUrl },
            { envUri, storeId, kind: 'specs' }
          )
          if (!isCurrent() || (notice && value.workGeneration < notice.workGeneration)) return
          latest.current.specs = value
          setSpecs({ identity, value })
          setSpecsError(undefined)
        } else {
          const value = await fetchBackendStoreContentProjection(
            { apiBaseUrl },
            { envUri, storeId, kind: 'changes' }
          )
          if (!isCurrent() || (notice && value.workGeneration < notice.workGeneration)) return
          latest.current.changes = value
          setChanges({ identity, value })
          setChangesError(undefined)
        }
      } catch (caught) {
        if (!isCurrent()) return
        const regionalError = {
          identity,
          message: caught instanceof Error ? caught.message : String(caught),
        }
        if (kind === 'specs') setSpecsError(regionalError)
        else setChangesError(regionalError)
      }
    },
    [apiBaseUrl, envUri, identity, storeId, supported]
  )

  useEffect(() => {
    const currentEpoch = ++epoch.current
    latest.current = { specs: undefined, changes: undefined }
    setSpecs(undefined)
    setChanges(undefined)
    setSpecsError(undefined)
    setChangesError(undefined)
    if (!apiBaseUrl || !supported) return

    const transports: CliProjectionTransport[] = []
    for (const kind of ['specs', 'changes'] as const) {
      void pull(kind, currentEpoch)
      transports.push(
        transportFactory.connect(
          apiBaseUrl,
          { kind: 'store-content', envUri, storeId, contentKind: kind },
          {
            onNotice(notice) {
              if (currentEpoch !== epoch.current) return
              const current = latest.current[kind]
              if (current && projectionMatchesNotice(current, notice)) return
              void pull(kind, currentEpoch, notice)
            },
            onConnectionState() {},
            onError(caught) {
              if (currentEpoch !== epoch.current) return
              const regionalError = {
                identity,
                message: caught instanceof Error ? caught.message : String(caught),
              }
              if (kind === 'specs') setSpecsError(regionalError)
              else setChangesError(regionalError)
            },
            onStopped() {},
            onComplete() {},
          }
        )
      )
    }
    return () => {
      epoch.current += 1
      transports.forEach((transport) => transport.unsubscribe())
    }
  }, [apiBaseUrl, envUri, identity, pull, storeId, supported, transportFactory])

  if (!apiBaseUrl) {
    const unavailable = {
      state: 'error',
      error: 'No current Environment source for Store content.',
    } as const
    return { specs: unavailable, changes: unavailable }
  }

  return {
    specs: projectStoreSpecsRegion(
      specs?.identity === identity ? specs.value : undefined,
      specsError?.identity === identity ? specsError.message : undefined,
      supported
    ),
    changes: projectStoreChangesRegion(
      changes?.identity === identity ? changes.value : undefined,
      changesError?.identity === identity ? changesError.message : undefined,
      supported
    ),
  }
}
