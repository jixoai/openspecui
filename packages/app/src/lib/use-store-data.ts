/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Pull typed Store list/Doctor Projection Work state after lifecycle-only Push.
 * 2. Retain same-locator Store data during revalidation, but mask it before a replacement locator's first render.
 * 3. Revoke Store mutation authority unless the Doctor projection and transport are current.
 * 4. Resolve hosted credentials only inside locator-scoped HTTP/WS clients.
 * 5. Expose explicit refresh as invalidation followed by Pull, never a polling loop.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import type {
  HostedCliProjectionNotice,
  HostedStoreDoctorProjectionState,
  HostedStoreListProjectionState,
} from '@openspecui/core/hosted-contract'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoreInspectorProjection, StoreInventoryProjection } from '../types/root-context'
import {
  fetchBackendStoreInspectorProjection,
  fetchBackendStoreInventoryProjection,
  refreshBackendStoreProjections,
} from './backend-client'
import {
  createTRPCCliProjectionTransportFactory,
  type CliProjectionTransport,
} from './cli-projection-transport'

export interface StoreDataState {
  inspector: StoreInspectorProjection | undefined
  inventory: StoreInventoryProjection | undefined
  isInspectorLoading: boolean
  isInventoryLoading: boolean
  isInspectorUpdating: boolean
  isInventoryUpdating: boolean
  inventoryError: Error | null
  inspectorError: Error | null
  /** True only when current Doctor CLI truth and its lifecycle transport can authorize a mutation. */
  canMutate: boolean
  refresh(): Promise<void>
}

export interface UseStoreDataOptions {
  apiBaseUrl?: string | null
}

interface StoreProjectionNotices {
  list: LocatorValue<HostedCliProjectionNotice> | null
  doctor: LocatorValue<HostedCliProjectionNotice> | null
}

interface StoreProjectionTransportCurrent {
  list: string | null
  doctor: string | null
}

/** A transport notice/error is meaningful only for the locator that delivered it. */
interface LocatorValue<T> {
  apiBaseUrl: string
  value: T
}

interface LocatorProjectionError extends LocatorValue<Error> {
  kind: 'list' | 'doctor'
}

function selectTransportError(
  error: LocatorProjectionError | null,
  apiBaseUrl: string | null | undefined,
  kind: LocatorProjectionError['kind']
): Error | null {
  if (!error || error.apiBaseUrl !== apiBaseUrl || error.kind !== kind) return null
  return error.value
}

/** A settled Store CLI state belongs to the locator that produced it, never the next selected backend. */
interface LocatorProjectionState<T> {
  apiBaseUrl: string
  state: T
}

function stateError(
  state: HostedStoreListProjectionState | HostedStoreDoctorProjectionState | undefined
): Error | null {
  if (!state) return null
  if (state.error) return new Error(state.error.message)
  const featureError = state.data?.error
  return featureError ? new Error(featureError.message) : null
}

function noticeMatchesReadyState(
  notice: HostedCliProjectionNotice | null,
  state: HostedStoreListProjectionState | HostedStoreDoctorProjectionState | undefined
): boolean {
  return Boolean(
    notice?.state === 'ready' &&
      state?.state === 'ready' &&
      notice.identity === state.identity &&
      notice.workGeneration === state.workGeneration &&
      notice.snapshotGeneration === state.snapshotGeneration
  )
}

/** Observe Store Inventory/Doctor as lifecycle Push followed by typed HTTP Pull. */
export function useStoreData(options: UseStoreDataOptions = {}): StoreDataState {
  const { apiBaseUrl } = options
  const [inventoryProjectionState, setInventoryProjectionState] =
    useState<LocatorProjectionState<HostedStoreListProjectionState>>()
  const [inspectorProjectionState, setInspectorProjectionState] =
    useState<LocatorProjectionState<HostedStoreDoctorProjectionState>>()
  const [notices, setNotices] = useState<StoreProjectionNotices>({ list: null, doctor: null })
  const [transportCurrent, setTransportCurrent] = useState<StoreProjectionTransportCurrent>({
    list: null,
    doctor: null,
  })
  const [transportError, setTransportError] = useState<LocatorProjectionError | null>(null)
  const requestEpoch = useRef(0)
  const pullSequence = useRef({ list: 0, doctor: 0 })
  const transportFactory = useMemo(createTRPCCliProjectionTransportFactory, [])

  const pull = useCallback(
    async (
      kind: 'list' | 'doctor',
      epoch = requestEpoch.current,
      expectedNotice?: HostedCliProjectionNotice
    ): Promise<void> => {
      if (!apiBaseUrl) return
      const sequence = ++pullSequence.current[kind]
      const isCurrentPull = () =>
        epoch === requestEpoch.current && sequence === pullSequence.current[kind]
      try {
        if (kind === 'list') {
          const state = await fetchBackendStoreInventoryProjection({ apiBaseUrl })
          if (!isCurrentPull()) return
          if (
            expectedNotice &&
            (state.identity !== expectedNotice.identity ||
              state.workGeneration < expectedNotice.workGeneration)
          ) {
            return
          }
          setInventoryProjectionState({ apiBaseUrl, state })
        } else {
          const state = await fetchBackendStoreInspectorProjection({ apiBaseUrl })
          if (!isCurrentPull()) return
          if (
            expectedNotice &&
            (state.identity !== expectedNotice.identity ||
              state.workGeneration < expectedNotice.workGeneration)
          ) {
            return
          }
          setInspectorProjectionState({ apiBaseUrl, state })
        }
      } catch (caught) {
        if (!isCurrentPull()) return
        setNotices((current) => ({ ...current, [kind]: null }))
        setTransportCurrent((current) => ({ ...current, [kind]: null }))
        setTransportError({
          apiBaseUrl,
          kind,
          value: caught instanceof Error ? caught : new Error(String(caught)),
        })
      }
    },
    [apiBaseUrl]
  )

  const refresh = useCallback(async (): Promise<void> => {
    if (!apiBaseUrl) return
    setNotices({ list: null, doctor: null })
    setTransportCurrent({ list: null, doctor: null })
    await refreshBackendStoreProjections({ apiBaseUrl })
    await Promise.all([pull('list'), pull('doctor')])
  }, [apiBaseUrl, pull])

  useEffect(() => {
    const epoch = ++requestEpoch.current
    setInventoryProjectionState(undefined)
    setInspectorProjectionState(undefined)
    setNotices({ list: null, doctor: null })
    setTransportCurrent({ list: null, doctor: null })
    setTransportError(null)
    if (!apiBaseUrl) return

    const transports: CliProjectionTransport[] = []
    const connect = (kind: 'list' | 'doctor') =>
      transportFactory.connect(
        apiBaseUrl,
        kind === 'list' ? { kind: 'store-list' } : { kind: 'store-doctor' },
        {
          onNotice(notice) {
            if (epoch !== requestEpoch.current) return
            setNotices((current) => ({ ...current, [kind]: { apiBaseUrl, value: notice } }))
            setTransportCurrent((current) => ({ ...current, [kind]: apiBaseUrl }))
            setTransportError(null)
            void pull(kind, epoch, notice)
          },
          onConnectionState() {
            if (epoch !== requestEpoch.current) return
            setNotices((current) => ({ ...current, [kind]: null }))
            setTransportCurrent((current) => ({ ...current, [kind]: null }))
          },
          onError(error) {
            if (epoch !== requestEpoch.current) return
            setNotices((current) => ({ ...current, [kind]: null }))
            setTransportCurrent((current) => ({ ...current, [kind]: null }))
            setTransportError({
              apiBaseUrl,
              kind,
              value: error instanceof Error ? error : new Error(String(error)),
            })
          },
          onStopped() {
            if (epoch !== requestEpoch.current) return
            setNotices((current) => ({ ...current, [kind]: null }))
            setTransportCurrent((current) => ({ ...current, [kind]: null }))
          },
          onComplete() {
            if (epoch !== requestEpoch.current) return
            setNotices((current) => ({ ...current, [kind]: null }))
            setTransportCurrent((current) => ({ ...current, [kind]: null }))
          },
        }
      )
    transports.push(connect('list'), connect('doctor'))

    return () => {
      requestEpoch.current += 1
      transports.forEach((transport) => transport.unsubscribe())
    }
  }, [apiBaseUrl, pull, transportFactory])

  const inventoryState =
    inventoryProjectionState && inventoryProjectionState.apiBaseUrl === apiBaseUrl
      ? inventoryProjectionState.state
      : undefined
  const inspectorState =
    inspectorProjectionState && inspectorProjectionState.apiBaseUrl === apiBaseUrl
      ? inspectorProjectionState.state
      : undefined
  const inventory = inventoryState?.data?.available ? inventoryState.data : undefined
  const inspector = inspectorState?.data?.available ? inspectorState.data : undefined
  const noticesForLocator: StoreProjectionNotices = {
    list: notices.list?.apiBaseUrl === apiBaseUrl ? notices.list : null,
    doctor: notices.doctor?.apiBaseUrl === apiBaseUrl ? notices.doctor : null,
  }
  const listNotice = noticesForLocator.list?.value ?? null
  const doctorNotice = noticesForLocator.doctor?.value ?? null
  const inventoryError =
    selectTransportError(transportError, apiBaseUrl, 'list') ?? stateError(inventoryState)
  const inspectorError =
    selectTransportError(transportError, apiBaseUrl, 'doctor') ?? stateError(inspectorState)
  const isInventoryLoading =
    Boolean(apiBaseUrl) && (!inventoryState || inventoryState.state === 'loading')
  const isInspectorLoading =
    Boolean(apiBaseUrl) && (!inspectorState || inspectorState.state === 'loading')
  const isInventoryUpdating =
    listNotice?.state === 'revalidating' || inventoryState?.state === 'revalidating'
  const isInspectorUpdating =
    doctorNotice?.state === 'revalidating' || inspectorState?.state === 'revalidating'
  const canMutate =
    transportCurrent.doctor === apiBaseUrl &&
    noticeMatchesReadyState(doctorNotice, inspectorState) &&
    inspectorState?.state === 'ready' &&
    inspectorState.data.available

  return {
    inspector,
    inventory,
    isInspectorLoading,
    isInventoryLoading,
    isInspectorUpdating,
    isInventoryUpdating,
    inventoryError,
    inspectorError,
    canMutate,
    refresh,
  }
}
