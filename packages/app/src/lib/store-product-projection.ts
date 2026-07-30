/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Join Store list, Doctor, Usage, and mutation facts by composite Environment/Store identity.
 * 2. Project observed-only index rows and Store Detail inputs without authorizing operations.
 * 3. Keep mutation and diagnostic failures direct while preserving upstream typed facts.
 *
 * Original request (2026-07-30): "StoreDetailPage应该如何设计呢？"
 * Spec: hosted-app-distribution > "Product-Shaped Store Index And Detail".
 */
import type { StoreMutationEnvelope } from '@openspecui/core/store-mutation-protocol'
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import type { StoreIndexRow } from '../components/stores-index'
import type {
  ProjectContextObservation,
  StoreInspectorProjection,
  StoreInventoryProjection,
} from '../types/root-context'
import type {
  StoreDetailChangesRegion,
  StoreDetailProjectionInput,
  StoreDetailSpecsRegion,
  StoreDetailUsageEntry,
} from './store-detail-projection'

/** Canonical settled Store registry/Doctor signature for same-Environment source comparison. */
export function createStoreEvidenceSignature(input: {
  readonly inventory: StoreInventoryProjection | undefined
  readonly inspector: StoreInspectorProjection | undefined
}): string | null {
  if (!input.inventory?.available || !input.inspector?.available) return null
  const inventory = input.inventory.stores
    .map((store) => ({ id: store.id, root: store.root }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const doctor = input.inspector.stores
    .flatMap((store) =>
      store.id
        ? [
            {
              id: store.id,
              root: store.root ?? null,
              healthy: store.openspec_root?.healthy ?? null,
              diagnostics: (store.status ?? []).map((diagnostic) => ({
                severity: diagnostic.severity ?? null,
                code: diagnostic.code ?? null,
                message: diagnostic.message ?? null,
              })),
            },
          ]
        : []
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  return JSON.stringify({ inventory, doctor })
}

function latestStoreMutation(
  records: readonly StoreMutationEnvelope[],
  envUri: string,
  storeId: string
): StoreMutationEnvelope | null {
  return (
    records
      .filter((record) => record.envUri === envUri && record.storeId === storeId)
      .sort((left, right) => right.observedAt - left.observedAt)[0] ?? null
  )
}

function mutationState(record: StoreMutationEnvelope | null): StoreIndexRow['mutationState'] {
  if (!record) return 'idle'
  return record.status === 'accepted' ? 'running' : record.status
}

function doctorHealth(store: StoreDoctorStore | undefined): StoreIndexRow['health'] {
  if (!store) return 'unknown'
  const severities = (store.status ?? []).map((diagnostic) => diagnostic.severity?.toLowerCase())
  if (
    severities.some(
      (severity) => severity === 'error' || severity === 'fatal' || severity === 'critical'
    )
  ) {
    return 'unhealthy'
  }
  if (severities.some((severity) => severity === 'warning' || severity === 'warn')) {
    return 'unhealthy'
  }
  if (store.openspec_root?.healthy === true) return 'healthy'
  if (store.openspec_root?.healthy === false) return 'unhealthy'
  return severities.length > 0 ? 'healthy' : 'unknown'
}

/** Select only current, source-labelled Root/Reference relationships observed inside one Environment. */
export function projectStoreUsage(
  projectContexts: readonly ProjectContextObservation[],
  envUri: string,
  storeId: string
): StoreDetailUsageEntry[] {
  const entries = new Map<string, StoreDetailUsageEntry>()
  for (const context of projectContexts) {
    const evidence = context.evidence
    if (!evidence || context.stale || evidence.source.health.envUri !== envUri) continue
    const label = evidence.projectName
    if (evidence.storeId === storeId) {
      const entry: StoreDetailUsageEntry = {
        kind: 'root-for',
        sourceId: evidence.source.tabId,
        ...(label ? { label } : {}),
      }
      entries.set(`${entry.kind}:${entry.sourceId}`, entry)
    }
    if (evidence.references.some((reference) => reference.storeId === storeId)) {
      const entry: StoreDetailUsageEntry = {
        kind: 'referenced-by',
        sourceId: evidence.source.tabId,
        ...(label ? { label } : {}),
      }
      entries.set(`${entry.kind}:${entry.sourceId}`, entry)
    }
  }
  return [...entries.values()]
}

/** Build Store index rows without merging same-id Stores across Environment identity. */
export function projectStoreIndexRows(input: {
  readonly envUri: string
  readonly inventory: StoreInventoryProjection | undefined
  readonly inspector: StoreInspectorProjection | undefined
  readonly projectContexts: readonly ProjectContextObservation[]
  readonly mutations: readonly StoreMutationEnvelope[]
}): StoreIndexRow[] {
  const doctors = new Map(
    (input.inspector?.stores ?? []).flatMap((store) =>
      store.id ? [[store.id, store] as const] : []
    )
  )
  return (input.inventory?.stores ?? []).map((store) => {
    const usage = projectStoreUsage(input.projectContexts, input.envUri, store.id)
    return {
      storeId: store.id,
      root: store.root,
      health: doctorHealth(doctors.get(store.id)),
      usage: {
        rootFor: usage.filter((entry) => entry.kind === 'root-for').length,
        referencedBy: usage.filter((entry) => entry.kind === 'referenced-by').length,
      },
      mutationState: mutationState(latestStoreMutation(input.mutations, input.envUri, store.id)),
    }
  })
}

/** Select one Doctor fact by Store id; route identity always supplies envUri separately. */
export function selectStoreDoctor(
  inspector: StoreInspectorProjection | undefined,
  storeId: string
): StoreDoctorStore | null {
  return inspector?.stores.find((store) => store.id === storeId) ?? null
}

/** Compose Store Detail's product projection from typed regional facts. */
export function projectStoreDetailInput(input: {
  readonly envUri: string
  readonly storeId: string
  readonly inventory: StoreInventoryProjection | undefined
  readonly inspector: StoreInspectorProjection | undefined
  readonly projectContexts: readonly ProjectContextObservation[]
  readonly mutations: readonly StoreMutationEnvelope[]
  readonly specs: StoreDetailSpecsRegion
  readonly changes: StoreDetailChangesRegion
  readonly hasAuthority: boolean
}): StoreDetailProjectionInput {
  const doctor = selectStoreDoctor(input.inspector, input.storeId)
  const inventoryStore = input.inventory?.stores.find((store) => store.id === input.storeId)
  const latestMutation = latestStoreMutation(input.mutations, input.envUri, input.storeId)
  const blockingDiagnostics = (doctor?.status ?? []).flatMap((diagnostic) => {
    const severity = diagnostic.severity?.toLowerCase() ?? ''
    if (!['error', 'fatal', 'critical'].includes(severity)) return []
    return [{ severity, message: diagnostic.message ?? 'OpenSpec reported a Store error.' }]
  })
  if (doctor?.openspec_root?.healthy === false && blockingDiagnostics.length === 0) {
    blockingDiagnostics.push({
      severity: 'error',
      message: 'The Store OpenSpec root is unhealthy.',
    })
  }
  const mutationError =
    latestMutation?.status === 'failed' || latestMutation?.status === 'indeterminate'
      ? (latestMutation.result.stderr ?? `Store mutation ${latestMutation.status}.`)
      : undefined
  return {
    identity: { envUri: input.envUri, storeId: input.storeId },
    health: doctorHealth(doctor ?? undefined),
    blockingDiagnostics,
    usage: projectStoreUsage(input.projectContexts, input.envUri, input.storeId),
    specs: input.specs,
    changes: input.changes,
    mutation: mutationState(latestMutation),
    ...(mutationError ? { mutationError } : {}),
    repository: {
      root: doctor?.root ?? inventoryStore?.root,
      ...(doctor?.metadata_path ? { metadataPath: doctor.metadata_path } : {}),
      ...(doctor?.git
        ? {
            gitRemote: doctor.git.origin_url,
            isRepository: doctor.git.is_repository,
          }
        : {}),
    },
    ...(input.inspector?.evidence !== undefined ? { evidence: input.inspector.evidence } : {}),
    hasAuthority: input.hasAuthority,
  }
}
