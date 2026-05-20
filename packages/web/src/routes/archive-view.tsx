import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import { fileCountLabel } from '@/components/opsx/opsx-markdown-files-viewer'
import { useArchiveSubscription } from '@/lib/use-subscription'
import { readSharedElementHandoffState } from '@/lib/view-transitions/shared-elements'
import type { OpsxEntityDetail } from '@openspecui/core'
import { getRouteApi, useLocation } from '@tanstack/react-router'
import { Archive } from 'lucide-react'

const route = getRouteApi('/archive/$changeId')

function getArchiveTitle(entity: OpsxEntityDetail | null | undefined, fallbackId: string): string {
  return entity?.id ?? fallbackId
}

export function ArchiveView() {
  const { changeId } = route.useParams()
  const location = useLocation()

  const { data: entity, isLoading, error } = useArchiveSubscription(changeId)
  const handoff = readSharedElementHandoffState(location.state)
  const isMissingArchiveError =
    error?.message.includes(`Archived change '${changeId}' not found`) ||
    error?.message.includes(`Archived change "${changeId}" not found`)

  return (
    <OpsxEntityDetailView
      entityId={changeId}
      sharedFamily="archive"
      backTo="/archive"
      backTitle="Back to Archive"
      icon={Archive}
      title={getArchiveTitle(entity, changeId)}
      subtitle={
        entity
          ? `${entity.schemaName ? `Schema: ${entity.schemaName}` : 'Schema: unknown'} · ${fileCountLabel(entity.files)}`
          : undefined
      }
      diagnostics={entity?.diagnostics}
      handoff={handoff}
      isLoading={isLoading && !entity}
      loadingMessage="Loading archived entity..."
      errorMessage={
        error && !isMissingArchiveError && !entity
          ? `Error loading archive: ${error.message}`
          : undefined
      }
      notFoundMessage={
        isMissingArchiveError && !entity
          ? 'Archived change not found in the current project.'
          : !entity && !isLoading && !error
            ? `Archived change not found: ${changeId}`
            : undefined
      }
      notFoundBackLabel="Back to Archive"
      artifacts={entity?.artifacts}
      hideEmptyArtifacts
      contentFallback={
        entity
          ? {
              id: 'content',
              label: 'Content',
              outputPath: 'openspec/changes/archive/**/*.md',
              relativePath: `archive/${changeId}`,
              files: entity.files,
              emptyMessage:
                'No Markdown files found. Open the folder view to inspect archived files.',
            }
          : undefined
      }
      folder={{
        changeId,
        archived: true,
      }}
      tabsQueryKey="archiveTab"
    />
  )
}
