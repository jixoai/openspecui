import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import { buildOpsxComposeHref, type OpsxComposeActionId } from '@/lib/opsx-compose'
import { useOpsxStatusSubscription } from '@/lib/use-opsx'
import { useChangeFilesSubscription } from '@/lib/use-subscription'
import { vtNavController } from '@/lib/view-transitions/navigation'
import { readSharedElementHandoffState } from '@/lib/view-transitions/shared-elements'
import { useLocation, useParams } from '@tanstack/react-router'
import { GitBranch } from 'lucide-react'
import { useCallback, useMemo } from 'react'

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const location = useLocation()
  const handoff = readSharedElementHandoffState(location.state)

  const { data: status, isLoading, error } = useOpsxStatusSubscription({ change: changeId })
  const { data: files } = useChangeFilesSubscription(changeId)

  const handleComposeAction = useCallback(
    (actionId: OpsxComposeActionId, artifactId?: string) => {
      const href = buildOpsxComposeHref({
        action: actionId,
        changeId,
        artifactId,
      })
      vtNavController.activatePop(href)
    },
    [changeId]
  )

  const handleVerify = useCallback(() => {
    vtNavController.activatePop(`/opsx-verify?change=${encodeURIComponent(changeId)}`)
  }, [changeId])

  const selectedArtifactId = useMemo(() => {
    if (!status) return undefined
    return status.artifacts.find((a) => a.status === 'ready')?.id ?? status.artifacts[0]?.id
  }, [status])

  const doneCount = status?.artifacts.filter((a) => a.status === 'done').length ?? 0
  const totalCount = status?.artifacts.length ?? 0
  const isMissingChangeError =
    error?.message.includes(`Change '${changeId}' not found`) ||
    error?.message.includes(`Change "${changeId}" not found`)

  return (
    <OpsxEntityDetailView
      entityId={changeId}
      sharedFamily="changes"
      backTo="/changes"
      backTitle="Back to Changes"
      icon={GitBranch}
      title={status?.changeName}
      subtitle={
        status ? `Schema: ${status.schemaName} · ${doneCount}/${totalCount} artifacts` : undefined
      }
      handoff={handoff}
      isLoading={isLoading && !status}
      loadingMessage="Loading change status..."
      errorMessage={
        error && !isMissingChangeError && !status
          ? `Error loading change: ${error.message}`
          : undefined
      }
      notFoundMessage={
        isMissingChangeError && !status
          ? 'Change not found in the current project.'
          : !status && !isLoading && !error
            ? 'Change not found.'
            : undefined
      }
      notFoundBackLabel="Back to Changes"
      artifacts={status?.artifacts}
      contentFallback={
        files
          ? {
              id: 'content',
              label: 'Content',
              outputPath: 'openspec/changes/**/*.md',
              relativePath: `changes/${changeId}`,
              files,
              emptyMessage: 'No Markdown files found. Open the folder view to inspect change files.',
            }
          : undefined
      }
      folder={{ changeId }}
      tabsQueryKey="artifact"
      initialTab={selectedArtifactId}
      toolbar={
        status ? (
          <ChangeCommandBar
            status={status}
            selectedArtifactId={selectedArtifactId}
            onComposeAction={handleComposeAction}
            onVerify={handleVerify}
          />
        ) : null
      }
    />
  )
}
