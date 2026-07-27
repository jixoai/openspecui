/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Build CLI-owned Spec membership from the active planning root and direct References.
 * 2. Read owned documents from planning-root services and referenced documents from CLI JSON.
 * 3. Preserve live referenced command provenance and evidence without synthesizing document fields.
 * 4. Reject mismatched Root/Store/spec provenance before publishing a Catalog or document.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import {
  CliProjectionCommandError,
  toCliProjectionCommandEvidence,
  type CliCommandResult,
  type CliDoctorReferenceEntry,
  type CliExecutor,
  type CliShowSpec,
  type CliSpecList,
  type OpenSpecCliContractExecutor,
  type RootContext,
} from '@openspecui/core'
import {
  buildSpecCatalog,
  type CliShowSpecDocument,
  type LiveSpecCatalogReferenceSource,
  type SpecCatalog,
  type SpecCommandEvidence,
  type SpecDocumentProjection,
  type SpecIdentity,
} from '@openspecui/core/spec-catalog'
import type { DocumentService } from './document-service.js'

/** Planning-root and CLI dependencies required to build/read the shared Spec Catalog. */
export interface SpecCatalogServiceSource {
  rootContext: RootContext
  documentService: Pick<DocumentService, 'readSpec' | 'readSpecRaw'>
  contracts: Pick<OpenSpecCliContractExecutor, 'listSpecs' | 'showSpec'>
}

/** Optional clock injection for deterministic Catalog observation timestamps. */
export interface ReadSpecCatalogOptions {
  now?: () => number
}

/** Exact compound identity was absent from the current direct project Catalog. */
export class SpecCatalogIdentityNotFoundError extends Error {
  constructor(readonly identity: SpecIdentity) {
    super('The requested Spec identity is not present in the active project catalog.')
    this.name = 'SpecCatalogIdentityNotFoundError'
  }
}

/** Build one collision-safe Catalog from exact typed CLI lists. */
export async function readSpecCatalog(
  source: SpecCatalogServiceSource,
  options: ReadSpecCatalogOptions = {}
): Promise<SpecCatalog> {
  const rootSelector =
    source.rootContext.storeId !== null ? { store: source.rootContext.storeId } : {}
  const [ownedList, references] = await Promise.all([
    source.contracts.listSpecs(rootSelector),
    Promise.all(
      source.rootContext.references.map((reference) => enumerateReference(source, reference))
    ),
  ])
  const ownedError = ownedListContractError(source.rootContext, ownedList)
  if (!ownedList.success || !ownedList.data || ownedError) {
    throw new CliProjectionCommandError(
      ownedError ||
        ownedList.contractError ||
        ownedList.stderr.trim() ||
        'OpenSpec returned no owned Spec list.',
      ownedError ? { ...ownedList, contractError: ownedError } : ownedList
    )
  }
  return buildSpecCatalog({
    owned: ownedList.data.specs,
    ownedProjection: {
      provenance: 'live',
      root: ownedList.data.root!,
      evidence: commandEvidence(ownedList),
    },
    referenced: references.flatMap((reference) =>
      reference.state === 'ready' ? [{ storeId: reference.storeId, specs: reference.specs }] : []
    ),
    referenceSources: references.map(({ specs: _specs, ...reference }) => reference),
    observedAt: (options.now ?? Date.now)(),
  })
}

function commandEvidence<T>(
  result: CliCommandResult<T>,
  contractError?: string
): SpecCommandEvidence {
  return toCliProjectionCommandEvidence(contractError ? { ...result, contractError } : result)
}

function ownedListContractError(
  rootContext: RootContext,
  result: CliCommandResult<CliSpecList>
): string | undefined {
  if (!result.data) {
    return result.contractError ?? 'OpenSpec returned no owned Spec list.'
  }
  if (!result.data.root) {
    return 'OpenSpec returned no Root provenance for the owned Spec list.'
  }
  if (!rootContext.planningRoot) {
    return 'The current Root Context has no Planning root for the owned Spec list.'
  }
  if (result.data.root.path !== rootContext.planningRoot.path) {
    return `OpenSpec returned Root ${result.data.root.path} for expected Planning root ${rootContext.planningRoot.path}.`
  }
  const expectedStore = rootContext.storeId
  const returnedStore = result.data.root.store_id ?? null
  if (returnedStore !== expectedStore) {
    return `OpenSpec returned Store ${returnedStore ?? '(none)'} for expected Store ${expectedStore ?? '(none)'}.`
  }
  return result.contractError
}

function referenceListContractError(
  result: CliCommandResult<CliSpecList>,
  storeId: string
): string | undefined {
  if (!result.data) {
    return result.contractError ?? `OpenSpec returned no Spec list for Store ${storeId}.`
  }
  const selectedStore = result.data.root?.store_id ?? null
  if (selectedStore === null) {
    return `OpenSpec returned no Store provenance for requested Store ${storeId}.`
  }
  if (selectedStore !== storeId) {
    return `OpenSpec returned Store ${selectedStore} for requested Store ${storeId}.`
  }
  return result.contractError
}

interface EnumeratedReference extends LiveSpecCatalogReferenceSource {
  specs: CliSpecList['specs']
}

async function enumerateReference(
  source: SpecCatalogServiceSource,
  reference: CliDoctorReferenceEntry
): Promise<EnumeratedReference> {
  const result = await source.contracts.listSpecs({ store: reference.store_id })
  const contractError = referenceListContractError(result, reference.store_id)
  const ready = result.success && result.data !== null && contractError === undefined
  return {
    storeId: reference.store_id,
    provenance: 'live',
    state: ready ? 'ready' : 'error',
    diagnostics: reference.status,
    evidence: commandEvidence(result, contractError),
    specs: ready ? result.data!.specs : [],
  }
}

function isShowSpecDocument(data: CliShowSpec | null): data is CliShowSpecDocument {
  return data !== null && 'id' in data && typeof data.id === 'string'
}

function showSpecDocument(
  result: Awaited<ReturnType<CliExecutor['contracts']['showSpec']>>
): CliShowSpecDocument | null {
  return isShowSpecDocument(result.data) ? result.data : null
}

function getDirectReference(
  source: SpecCatalogServiceSource,
  identity: SpecIdentity
): CliDoctorReferenceEntry | null {
  if (identity.kind !== 'referenced') return null
  return (
    source.rootContext.references.find((reference) => reference.store_id === identity.storeId) ??
    null
  )
}

/** Read the exact owned or referenced Spec identity without a bare-id fallback. */
export async function readSpecDocument(
  source: SpecCatalogServiceSource,
  identity: SpecIdentity
): Promise<SpecDocumentProjection> {
  if (identity.kind === 'owned') {
    const [spec, raw] = await Promise.all([
      source.documentService.readSpec(identity.specId),
      source.documentService.readSpecRaw(identity.specId, 'view', 'processed'),
    ])
    return {
      identity,
      source: 'owned',
      readOnly: false,
      state: spec ? 'ready' : 'not-found',
      spec,
      rawMarkdown: raw?.markdown ?? null,
      upstream: null,
      evidence: null,
    }
  }

  const reference = getDirectReference(source, identity)
  if (!reference) {
    throw new SpecCatalogIdentityNotFoundError(identity)
  }

  const enumeration = await enumerateReference(source, reference)
  if (enumeration.state === 'error') {
    return {
      identity,
      source: 'referenced',
      readOnly: true,
      state: 'error',
      spec: null,
      rawMarkdown: null,
      upstream: null,
      provenance: { kind: 'live' },
      evidence: enumeration.evidence,
    }
  }
  if (!enumeration.specs.some((spec) => spec.id === identity.specId)) {
    throw new SpecCatalogIdentityNotFoundError(identity)
  }

  const result = await source.contracts.showSpec(identity.specId, { store: identity.storeId })
  const upstream = showSpecDocument(result)
  const returnedStore = upstream?.root?.store_id ?? null
  const identityError = (() => {
    if (upstream && upstream.id !== identity.specId) {
      return `OpenSpec returned Spec ${upstream.id} for requested identity ${identity.specId}.`
    }
    if (upstream && returnedStore === null) {
      return `OpenSpec returned no Store provenance for requested Store ${identity.storeId}.`
    }
    if (upstream && returnedStore !== identity.storeId) {
      return `OpenSpec returned Store ${returnedStore} for requested Store ${identity.storeId}.`
    }
    return undefined
  })()
  const ready = result.success && upstream !== null && !identityError

  return {
    identity,
    source: 'referenced',
    readOnly: true,
    state: ready ? 'ready' : 'error',
    spec: null,
    rawMarkdown: null,
    upstream: ready ? upstream : null,
    provenance: { kind: 'live' },
    evidence: commandEvidence(result, identityError),
  }
}
