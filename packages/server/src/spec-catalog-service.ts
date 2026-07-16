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
  CliExecutor,
  CliShowSpec,
  OpenSpecAdapter,
  OpenSpecCliContractExecutor,
  RootContext,
} from '@openspecui/core'
import {
  buildSpecCatalog,
  type CliShowSpecDocument,
  type SpecCatalog,
  type SpecCommandEvidence,
  type SpecDocumentProjection,
  type SpecIdentity,
} from '@openspecui/core/spec-catalog'
import type { DocumentService } from './document-service.js'

export interface SpecCatalogServiceSource {
  rootContext: RootContext
  adapter: Pick<OpenSpecAdapter, 'listSpecsWithMeta'>
  documentService: Pick<DocumentService, 'readSpec' | 'readSpecRaw'>
  contracts: Pick<OpenSpecCliContractExecutor, 'showSpec'>
}

export interface ReadSpecCatalogOptions {
  now?: () => number
}

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
  const owned = await source.adapter.listSpecsWithMeta()
  return buildSpecCatalog({
    owned,
    references: source.rootContext.references,
    observedAt: (options.now ?? Date.now)(),
  })
}

function commandEvidence(
  result: Awaited<ReturnType<CliExecutor['contracts']['showSpec']>>,
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

function isShowSpecDocument(data: CliShowSpec | null): data is CliShowSpecDocument {
  return data !== null && 'id' in data && typeof data.id === 'string'
}

function showSpecDocument(
  result: Awaited<ReturnType<CliExecutor['contracts']['showSpec']>>
): CliShowSpecDocument | null {
  return isShowSpecDocument(result.data) ? result.data : null
}

function isDirectReference(source: SpecCatalogServiceSource, identity: SpecIdentity): boolean {
  if (identity.kind !== 'referenced') return true
  return source.rootContext.references.some(
    (reference) =>
      reference.store_id === identity.storeId &&
      reference.specs?.some((spec) => spec.id === identity.specId)
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

  if (!isDirectReference(source, identity)) {
    throw new SpecCatalogIdentityNotFoundError(identity)
  }

  const result = await source.contracts.showSpec(identity.specId, { store: identity.storeId })
  const upstream = showSpecDocument(result)
  const identityError =
    upstream && upstream.id !== identity.specId
      ? `OpenSpec returned Spec ${upstream.id} for requested identity ${identity.specId}.`
      : undefined

  return {
    identity,
    source: 'referenced',
    readOnly: true,
    state: result.success && upstream !== null && !identityError ? 'ready' : 'error',
    spec: null,
    rawMarkdown: null,
    upstream,
    evidence: commandEvidence(result, identityError),
  }
}
