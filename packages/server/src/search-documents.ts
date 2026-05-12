import type { OpenSpecAdapter } from '@openspecui/core'
import type { SearchDocument } from '@openspecui/search'
import type { DocumentService } from './document-service.js'

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join('\n\n')
}

export async function collectSearchDocuments(
  adapter: OpenSpecAdapter,
  documentService?: DocumentService
): Promise<SearchDocument[]> {
  const docs: SearchDocument[] = []

  const specs = await adapter.listSpecsWithMeta()
  for (const spec of specs) {
    const raw = documentService
      ? await documentService.readSpecRaw(spec.id, 'search', 'processed')
      : await adapter.readSpecRaw(spec.id)
    if (!raw) continue

    docs.push({
      id: `spec:${spec.id}`,
      kind: 'spec',
      title: spec.name,
      href: `/specs/${encodeURIComponent(spec.id)}`,
      path: `openspec/specs/${spec.id}/spec.md`,
      content: typeof raw === 'string' ? raw : raw.markdown,
      updatedAt: spec.updatedAt,
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
    const raw = documentService
      ? await documentService.readArchivedChangeRaw(archive.id, 'search', 'processed')
      : await adapter.readArchivedChangeRaw(archive.id)
    if (!raw) continue

    docs.push({
      id: `archive:${archive.id}`,
      kind: 'archive',
      title: archive.name,
      href: `/archive/${encodeURIComponent(archive.id)}`,
      path: `openspec/changes/archive/${archive.id}`,
      content: joinParts([
        typeof raw.proposal === 'string' ? raw.proposal : raw.proposal.markdown,
        typeof raw.tasks === 'string' ? raw.tasks : raw.tasks.markdown,
        typeof raw.design === 'string' ? raw.design : raw.design?.markdown,
        ...raw.deltaSpecs.map((deltaSpec) => deltaSpec.content),
      ]),
      updatedAt: archive.updatedAt,
    })
  }

  return docs
}
