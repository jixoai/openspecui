/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Render schema-aware change artifacts and source files.
 * 2. Dispatch change workflows through routed compose/verify surfaces.
 * 3. Lock every change workflow action behind current Root Context readiness.
 * 4. Attribute Apply instruction divergence without replacing tracked task truth.
 * 5. Preserve CLI path/action context, Reference evidence, and strict archive diagnostics.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { ApplyProgressNotice } from '@/components/apply-progress-notice'
import { ChangeContextEvidence } from '@/components/change-context-evidence'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import { RootActionNotice } from '@/components/root-action-notice'
import { useArchiveModal } from '@/lib/archive-modal-context'
import { buildOpsxComposeHref, type OpsxComposeActionId } from '@/lib/opsx-compose'
import { useOpsxApplyInstructionsSubscription, useOpsxStatusSubscription } from '@/lib/use-opsx'
import { useRootActionState } from '@/lib/use-root-action-state'
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
  const rootAction = useRootActionState()
  const { openArchiveModal } = useArchiveModal()

  const { data: status, isLoading, error } = useOpsxStatusSubscription({ change: changeId })
  const { data: applyInstructions } = useOpsxApplyInstructionsSubscription({ change: changeId })
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

  const handleArchive = useCallback(() => {
    openArchiveModal(changeId, status?.changeName ?? changeId)
  }, [changeId, openArchiveModal, status?.changeName])

  const selectedArtifactId = useMemo(() => {
    if (!status) return undefined
    return status.artifacts.find((a) => a.status === 'ready')?.id ?? status.artifacts[0]?.id
  }, [status])

  const doneCount = status?.artifacts.filter((a) => a.status === 'done').length ?? 0
  const totalCount = status?.artifacts.length ?? 0
  const isMissingChangeError =
    error?.message.includes(`Change '${changeId}' not found`) ||
    error?.message.includes(`Change "${changeId}" not found`)
  const rootFailureMessage =
    rootAction.status === 'blocked'
      ? [rootAction.message, ...rootAction.evidence].join('\n')
      : undefined

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
      isLoading={(isLoading || rootAction.status === 'checking') && !status}
      loadingMessage="Loading change status..."
      errorMessage={
        rootFailureMessage && !status
          ? rootFailureMessage
          : error && !isMissingChangeError && !status
            ? `Error loading change: ${error.message}`
            : undefined
      }
      notFoundMessage={
        !rootAction.disabled && isMissingChangeError && !status
          ? 'Change not found in the current project.'
          : !rootAction.disabled && !status && !isLoading && !error
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
              emptyMessage:
                'No Markdown files found. Open the folder view to inspect change files.',
            }
          : undefined
      }
      folder={{ changeId }}
      tabsQueryKey="artifact"
      initialTab={selectedArtifactId}
      toolbar={
        status ? (
          <div className="flex flex-col gap-2">
            <RootActionNotice state={rootAction} />
            <ChangeContextEvidence
              status={status}
              references={rootAction.context?.references ?? []}
            />
            {applyInstructions ? (
              <ApplyProgressNotice
                applyInstructionProgress={applyInstructions.applyInstructionProgress}
              />
            ) : null}
            <ChangeCommandBar
              status={status}
              selectedArtifactId={selectedArtifactId}
              actionDisabled={rootAction.disabled}
              actionDisabledReason={rootAction.message ?? undefined}
              onComposeAction={handleComposeAction}
              onArchive={handleArchive}
              onVerify={handleVerify}
            />
          </div>
        ) : null
      }
    />
  )
}
