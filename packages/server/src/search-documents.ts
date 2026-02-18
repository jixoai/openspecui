import type { OpenSpecAdapter } from '@openspecui/core'
import type { SearchDocument } from '@openspecui/search'

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join('\n\n')
}

export async function collectSearchDocuments(adapter: OpenSpecAdapter): Promise<SearchDocument[]> {
  const docs: SearchDocument[] = []

  const specs = await adapter.listSpecsWithMeta()
  for (const spec of specs) {
    const raw = await adapter.readSpecRaw(spec.id)
    if (!raw) continue

    docs.push({
      id: `spec:${spec.id}`,
      kind: 'spec',
      title: spec.name,
      href: `/specs/${encodeURIComponent(spec.id)}`,
      path: `openspec/specs/${spec.id}/spec.md`,
      content: raw,
      updatedAt: spec.updatedAt,
    })
  }

  const changes = await adapter.listChangesWithMeta()
  for (const change of changes) {
    const raw = await adapter.readChangeRaw(change.id)
    if (!raw) continue

    docs.push({
      id: `change:${change.id}`,
      kind: 'change',
      title: change.name,
      href: `/changes/${encodeURIComponent(change.id)}`,
      path: `openspec/changes/${change.id}`,
      content: joinParts([
        raw.proposal,
        raw.tasks,
        raw.design,
        ...raw.deltaSpecs.map((deltaSpec) => deltaSpec.content),
      ]),
      updatedAt: change.updatedAt,
    })
  }

  const archives = await adapter.listArchivedChangesWithMeta()
  for (const archive of archives) {
    const raw = await adapter.readArchivedChangeRaw(archive.id)
    if (!raw) continue

    docs.push({
      id: `archive:${archive.id}`,
      kind: 'archive',
      title: archive.name,
      href: `/archive/${encodeURIComponent(archive.id)}`,
      path: `openspec/changes/archive/${archive.id}`,
      content: joinParts([
        raw.proposal,
        raw.tasks,
        raw.design,
        ...raw.deltaSpecs.map((deltaSpec) => deltaSpec.content),
      ]),
      updatedAt: archive.updatedAt,
    })
  }

  return docs
}
