/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Project Planning-root Specs, Changes, and Archives into search documents.
 * 2. Preserve compound identity for read-only Referenced Specs.
 * 3. Apply processed document reads without flattening entity provenance.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import type { OpenSpecAdapter, OpsxEntityReadOptions, OpsxEntityStage } from '@openspecui/core'
import {
  specIdentityKey,
  specRoutePath,
  type ReferencedSpecCatalogEntry,
} from '@openspecui/core/spec-catalog'
import type { ProjectSearchDocument } from '@openspecui/search'
import type { DocumentService } from './document-service.js'

/** Resolve stage-specific processed-document options for one searchable entity. */
export type EntityReadOptionsResolver = (
  stage: OpsxEntityStage,
  id: string
) => Promise<OpsxEntityReadOptions>

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join('\n\n')
}

/** Collect the complete search index projection owned by one Planning-root service record. */
export async function collectSearchDocuments(
  adapter: OpenSpecAdapter,
  documentService?: DocumentService,
  resolveEntityReadOptions?: EntityReadOptionsResolver,
  referencedSpecs: readonly ReferencedSpecCatalogEntry[] = []
): Promise<ProjectSearchDocument[]> {
  const docs: ProjectSearchDocument[] = []

  const specs = await adapter.listSpecsWithMeta()
  for (const spec of specs) {
    const identity = { kind: 'owned' as const, specId: spec.id }
    const raw = documentService
      ? await documentService.readSpecRaw(spec.id, 'search', 'processed')
      : await adapter.readSpecRaw(spec.id)
    if (!raw) continue

    docs.push({
      id: `spec:${specIdentityKey(identity)}`,
      kind: 'spec',
      scope: 'active-root',
      title: spec.name,
      href: specRoutePath(identity),
      path: `owned:openspec/specs/${spec.id}/spec.md`,
      content: typeof raw === 'string' ? raw : raw.markdown,
      updatedAt: spec.updatedAt,
    })
  }

  for (const spec of referencedSpecs) {
    docs.push({
      id: `spec:${specIdentityKey(spec.identity)}`,
      kind: 'spec',
      scope: 'referenced-specs',
      title: spec.name,
      href: specRoutePath(spec.identity),
      path: `referenced:${spec.identity.storeId}:specs/${spec.identity.specId}`,
      content: `Requirement count: ${spec.requirementCount}`,
      updatedAt: 0,
    })
  }

  const changes = await adapter.listChangesWithMeta()
  for (const change of changes) {
    const raw = documentService
      ? await documentService.readChangeRaw(change.id, 'search', 'processed')
      : await adapter.readChangeRaw(change.id)
    if (!raw) continue

    docs.push({
      id: `change:${change.id}`,
      kind: 'change',
      scope: 'active-root',
      title: change.name,
      href: `/changes/${encodeURIComponent(change.id)}`,
      path: `openspec/changes/${change.id}`,
      content: joinParts([
        typeof raw.proposal === 'string' ? raw.proposal : raw.proposal.markdown,
        typeof raw.tasks === 'string' ? raw.tasks : raw.tasks.markdown,
        typeof raw.design === 'string' ? raw.design : raw.design?.markdown,
        ...raw.deltaSpecs.map((deltaSpec) => deltaSpec.content),
      ]),
      updatedAt: change.updatedAt,
    })
  }

  const archives = await adapter.listArchivedChangesWithMeta()
  for (const archive of archives) {
    const entityOptions = resolveEntityReadOptions
      ? await resolveEntityReadOptions('archive', archive.id)
      : undefined
    const entity = documentService
      ? await documentService.readEntityDetail(
          'archive',
          archive.id,
          'search',
          'processed',
          entityOptions
        )
      : await adapter.readEntityDetail('archive', archive.id)
    if (!entity) continue

    docs.push({
      id: `archive:${archive.id}`,
      kind: 'archive',
      scope: 'active-root',
      title: archive.name,
      href: `/archive/${encodeURIComponent(archive.id)}`,
      path: `openspec/changes/archive/${archive.id}`,
      content: joinParts(
        entity.files.filter((file) => file.type === 'file').map((file) => file.content)
      ),
      updatedAt: archive.updatedAt,
    })
  }

  return docs
}
