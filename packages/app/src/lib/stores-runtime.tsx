/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Own selected-Environment Store list/Doctor and mutation lifecycle across Stores routes.
 * 2. Resolve and pin exact Environment authority without exposing backend selection as product UI.
 * 3. Publish product-ready Store rows, Usage evidence, and mutation admission correlation.
 * 4. Keep Store work dormant outside the Stores route family.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution > "Product-Shaped Store Index And Detail".
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useStoreMutationLifecycle } from '../components/store-mutation-lifecycle'
import type { EnvironmentEvidenceEntry } from '../components/stores-environment-evidence'
import type { StoreIndexRow } from '../components/stores-index'
import type { ProjectContextObservation } from '../types/root-context'
import type { BackendStoreMutateInput, BackendStoreMutationRecord } from './backend-client'
import { useConnectionObservations, type ConnectionObservation } from './connection-observation'
import {
  pinEnvironmentActionAuthority,
  resolveEnvironmentAuthority,
  resolveEnvironmentSelection,
  revalidateEnvironmentAuthority,
  type EnvironmentActionAuthority,
  type EnvironmentAuthorityResolution,
  type EnvironmentSelectionState,
  type EnvironmentSourceObservation,
} from './environment-authority'
import { useStoreEnvironmentMutationDispatcher } from './store-action-environment-authority'
import { useStoreEnvironmentSelection } from './store-environment-selection'
import {
  projectEnvironmentSources,
  projectStoresEnvironmentEvidence,
} from './store-environment-source'
import { createStoreEvidenceSignature, projectStoreIndexRows } from './store-product-projection'
import { deriveProjectContexts, projectRootObservation } from './use-environment'
import { useStoreData, type StoreDataState } from './use-store-data'

export interface StoresRuntimeValue {
  readonly observations: readonly ConnectionObservation[]
  readonly environmentSources: readonly EnvironmentSourceObservation[]
  readonly environments: readonly EnvironmentEvidenceEntry[]
  readonly selection: EnvironmentSelectionState
  readonly selectedEnvUri: string | null
  readonly authority: EnvironmentAuthorityResolution
  /** Deterministic current source used for reads; conflict removes mutation authority, not evidence. */
  readonly readSource: EnvironmentSourceObservation | null
  readonly storeData: StoreDataState
  readonly projectContexts: readonly ProjectContextObservation[]
  readonly rows: readonly StoreIndexRow[]
  readonly mutationRecords: readonly StoreMutationEnvelope[]
  readonly contentSupported: boolean
  selectEnvironment(envUri: string): void
  pinMutationAuthority(): EnvironmentActionAuthority | null
  isMutationAuthorityCurrent(authority: EnvironmentActionAuthority | null): boolean
  mutate(
    authority: EnvironmentActionAuthority | null,
    input: BackendStoreMutateInput
  ): Promise<BackendStoreMutationRecord | null>
}

const StoresRuntimeContext = createContext<StoresRuntimeValue | null>(null)

interface SourceStoreData {
  readonly source: EnvironmentSourceObservation
  readonly data: StoreDataState
}

const EMPTY_STORE_DATA: StoreDataState = {
  inspector: undefined,
  inventory: undefined,
  isInspectorLoading: false,
  isInventoryLoading: false,
  isInspectorUpdating: false,
  isInventoryUpdating: false,
  inventoryError: null,
  inspectorError: null,
  canMutate: false,
  async refresh() {},
}

function environmentSourceKey(source: EnvironmentSourceObservation): string {
  return [
    source.tabId,
    source.sessionId,
    source.apiBaseUrl,
    String(source.tabCreatedAt),
    String(source.generation),
  ].join('\u0000')
}

function StoreSourceDataCollector({
  source,
  onChange,
  onRemove,
}: {
  readonly source: EnvironmentSourceObservation
  readonly onChange: (key: string, value: SourceStoreData) => void
  readonly onRemove: (key: string) => void
}) {
  const key = environmentSourceKey(source)
  const data = useStoreData({
    apiBaseUrl: source.compatible && source.reachability === 'online' ? source.apiBaseUrl : null,
  })
  useEffect(() => {
    onChange(key, { source, data })
  }, [
    data.canMutate,
    data.inspector,
    data.inspectorError,
    data.inventory,
    data.inventoryError,
    data.isInspectorLoading,
    data.isInspectorUpdating,
    data.isInventoryLoading,
    data.isInventoryUpdating,
    data.refresh,
    key,
    onChange,
    source,
  ])
  useEffect(() => () => onRemove(key), [key, onRemove])
  return null
}

/** Install the Store data owner once around routed content; disabled mode performs no Store projection work. */
export function StoresRuntimeProvider({
  enabled,
  children,
}: {
  readonly enabled: boolean
  readonly children: ReactNode
}) {
  const connectionSnapshot = useConnectionObservations()
  const observations = connectionSnapshot.observations
  const baseEnvironmentSources = useMemo(
    () => projectEnvironmentSources(observations),
    [connectionSnapshot.revision, observations]
  )
  const [sourceStoreData, setSourceStoreData] = useState<ReadonlyMap<string, SourceStoreData>>(
    () => new Map()
  )
  const recordSourceData = useCallback((key: string, value: SourceStoreData) => {
    setSourceStoreData((current) => {
      const next = new Map(current)
      next.set(key, value)
      return next
    })
  }, [])
  const removeSourceData = useCallback((key: string) => {
    setSourceStoreData((current) => {
      if (!current.has(key)) return current
      const next = new Map(current)
      next.delete(key)
      return next
    })
  }, [])
  const environmentSources = useMemo(
    () =>
      baseEnvironmentSources.map((source) => {
        const observation = sourceStoreData.get(environmentSourceKey(source))
        const settled = Boolean(
          observation &&
            !observation.data.isInventoryLoading &&
            !observation.data.isInspectorLoading &&
            !observation.data.isInventoryUpdating &&
            !observation.data.isInspectorUpdating &&
            !observation.data.inventoryError &&
            !observation.data.inspectorError
        )
        const signature =
          observation && settled ? createStoreEvidenceSignature(observation.data) : null
        return signature ? { ...source, storeEvidenceSignature: signature } : source
      }),
    [baseEnvironmentSources, sourceStoreData]
  )
  const environments = useMemo(
    () =>
      projectStoresEnvironmentEvidence(observations).map((environment) => {
        const resolution = resolveEnvironmentAuthority(
          { selectedEnvUri: environment.envUri },
          environmentSources
        )
        return resolution.kind === 'conflict'
          ? {
              ...environment,
              conflict: { message: 'Current sources disagree on settled Store evidence.' },
            }
          : environment
      }),
    [environmentSources, observations]
  )
  const projectContexts = useMemo(
    () => deriveProjectContexts(observations.map(projectRootObservation)),
    [connectionSnapshot.revision, observations]
  )
  const [storedSelection, selectEnvironment] = useStoreEnvironmentSelection()
  const selectionResolution = resolveEnvironmentSelection(storedSelection, environmentSources)
  const effectiveSelection: EnvironmentSelectionState =
    selectionResolution.kind === 'selected'
      ? { selectedEnvUri: selectionResolution.envUri }
      : storedSelection
  const retainedReadSource = useRef<EnvironmentSourceObservation | null>(null)
  const authority = enabled
    ? resolveEnvironmentAuthority(
        effectiveSelection,
        environmentSources,
        retainedReadSource.current
      )
    : ({ kind: 'no-environment' } satisfies EnvironmentAuthorityResolution)
  if (authority.kind === 'authority') retainedReadSource.current = authority.source
  const selectedSources = environmentSources
    .filter(
      (source) =>
        source.envUri === effectiveSelection.selectedEnvUri &&
        source.compatible &&
        source.reachability === 'online'
    )
    .sort(
      (left, right) =>
        left.tabCreatedAt - right.tabCreatedAt || left.tabId.localeCompare(right.tabId)
    )
  const readSource =
    authority.kind === 'authority' || authority.kind === 'conflict'
      ? authority.source
      : (selectedSources[0] ?? null)
  const storeData = readSource
    ? (sourceStoreData.get(environmentSourceKey(readSource))?.data ?? {
        ...EMPTY_STORE_DATA,
        isInspectorLoading: true,
        isInventoryLoading: true,
      })
    : EMPTY_STORE_DATA
  const lifecycle = useStoreMutationLifecycle(
    enabled ? readSource?.apiBaseUrl : null,
    storeData.refresh
  )
  const mutationRecords = lifecycle.locator?.records ?? []
  const authorityContextRef = useRef({
    selection: effectiveSelection,
    observations: environmentSources,
  })
  authorityContextRef.current = { selection: effectiveSelection, observations: environmentSources }
  const resolveAuthorityContext = useCallback(() => authorityContextRef.current, [])
  const dispatch = useStoreEnvironmentMutationDispatcher(resolveAuthorityContext)
  const mutate = useCallback(
    async (
      pinnedAuthority: EnvironmentActionAuthority | null,
      input: BackendStoreMutateInput
    ): Promise<BackendStoreMutationRecord | null> => {
      const admission = await dispatch(pinnedAuthority, input)
      if (admission && pinnedAuthority) {
        lifecycle.registerAdmission(pinnedAuthority.apiBaseUrl, admission)
      }
      return admission
    },
    [dispatch, lifecycle]
  )
  const rows = useMemo(
    () =>
      effectiveSelection.selectedEnvUri
        ? projectStoreIndexRows({
            envUri: effectiveSelection.selectedEnvUri,
            inventory: storeData.inventory,
            inspector: storeData.inspector,
            projectContexts,
            mutations: mutationRecords,
          })
        : [],
    [
      effectiveSelection.selectedEnvUri,
      mutationRecords,
      projectContexts,
      storeData.inspector,
      storeData.inventory,
    ]
  )
  const pinMutationAuthority = useCallback(
    () =>
      authority.kind === 'authority' && storeData.canMutate
        ? pinEnvironmentActionAuthority(authority.source)
        : null,
    [authority, storeData.canMutate]
  )
  const isMutationAuthorityCurrent = useCallback(
    (pinnedAuthority: EnvironmentActionAuthority | null) =>
      Boolean(
        pinnedAuthority &&
          storeData.canMutate &&
          revalidateEnvironmentAuthority(pinnedAuthority, environmentSources).kind === 'valid'
      ),
    [environmentSources, storeData.canMutate]
  )
  const contentSupported = Boolean(
    readSource?.compatible &&
      observations
        .find((observation) => observation.tabId === readSource.tabId)
        ?.health?.hostedCapabilities?.includes('stores.content.inspect')
  )
  const value: StoresRuntimeValue = {
    observations,
    environmentSources,
    environments,
    selection: effectiveSelection,
    selectedEnvUri: effectiveSelection.selectedEnvUri,
    authority,
    readSource,
    storeData,
    projectContexts,
    rows,
    mutationRecords,
    contentSupported,
    selectEnvironment,
    pinMutationAuthority,
    isMutationAuthorityCurrent,
    mutate,
  }

  return (
    <>
      {enabled
        ? baseEnvironmentSources.map((source) => (
            <StoreSourceDataCollector
              key={environmentSourceKey(source)}
              source={source}
              onChange={recordSourceData}
              onRemove={removeSourceData}
            />
          ))
        : null}
      <StoresRuntimeContext.Provider value={value}>{children}</StoresRuntimeContext.Provider>
    </>
  )
}

/** Read the mounted Stores runtime owner. */
export function useStoresRuntime(): StoresRuntimeValue {
  const runtime = useContext(StoresRuntimeContext)
  if (!runtime) throw new Error('StoresRuntimeProvider is required.')
  return runtime
}
