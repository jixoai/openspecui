/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Build the project Spec Catalog from the active planning root and direct References.
 * 2. Read owned documents from planning-root services and referenced documents from CLI JSON.
 * 3. Preserve referenced command evidence without synthesizing document fields.
 * 4. Reject Store/spec identities outside the current Root Context Reference index.
 *
 * Original request (2026-07-15): "Live and static modes share one source-aware Spec Catalog."
 */
import type {
  CliCommandResult,
  CliDoctorReferenceEntry,
  CliExecutor,
  CliShowSpec,
  CliSpecList,
  OpenSpecAdapter,
  OpenSpecCliContractExecutor,
  RootContext,
} from '@openspecui/core'
import {
  buildSpecCatalog,
  type CliShowSpecDocument,
  type SpecCatalog,
  type SpecCatalogReferenceSource,
  type SpecCommandEvidence,
  type SpecDocumentProjection,
  type SpecIdentity,
} from '@openspecui/core/spec-catalog'
import type { DocumentService } from './document-service.js'

/** Planning-root and CLI dependencies required to build/read the shared Spec Catalog. */
export interface SpecCatalogServiceSource {
  rootContext: RootContext
  adapter: Pick<OpenSpecAdapter, 'listSpecsWithMeta'>
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

/** Build one collision-safe catalog from owned metadata and the direct CLI Reference index. */
export async function readSpecCatalog(
  source: SpecCatalogServiceSource,
  options: ReadSpecCatalogOptions = {}
): Promise<SpecCatalog> {
  const [owned, references] = await Promise.all([
    source.adapter.listSpecsWithMeta(),
    Promise.all(
      source.rootContext.references.map((reference) => enumerateReference(source, reference))
    ),
  ])
  return buildSpecCatalog({
    owned,
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
  return {
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    diagnostics: result.diagnostics,
    ...(contractError || result.contractError
      ? { contractError: contractError ?? result.contractError }
      : {}),
  }
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

interface EnumeratedReference extends SpecCatalogReferenceSource {
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
    evidence: commandEvidence(result, identityError),
  }
}
