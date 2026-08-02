/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Render schema-aware change artifacts and source files while retaining terminal status errors.
 * 2. Dispatch change workflows through routed compose/verify surfaces and the shared Operator launcher.
 * 3. Lock every change workflow action behind current Root Context and Status projection authority.
 * 4. Present Apply progress, project context, and operation guidance without conflating artifact rules.
 * 5. Preserve CLI path/action context, Reference evidence, and strict archive diagnostics.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Review request (2026-07-23): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Original request (2026-07-28): Board and Change Detail must use the same Operator owners.
 * Original request (2026-08-01): preserve OpenSpec 1.7 Apply operation inputs end to end.
 */
import { ApplyProgressNotice } from '@/components/apply-progress-notice'
import { ChangeContextEvidence } from '@/components/change-context-evidence'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { OperationInputs } from '@/components/opsx/operation-inputs'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import { RootActionNotice } from '@/components/root-action-notice'
import { buildOpsxComposeHref, type OpsxComposeActionId } from '@/lib/opsx-compose'
import { useChangeOperatorLauncher } from '@/lib/use-change-operator-launcher'
import { useOpsxApplyInstructionsSubscription, useOpsxStatusSubscription } from '@/lib/use-opsx'
import { useChangeFilesSubscription } from '@/lib/use-subscription'
import { vtNavController } from '@/lib/view-transitions/navigation'
import { readSharedElementHandoffState } from '@/lib/view-transitions/shared-elements'
import { useLocation, useParams } from '@tanstack/react-router'
import { AlertCircle, GitBranch } from 'lucide-react'
import { useCallback, useMemo } from 'react'

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const location = useLocation()
  const handoff = readSharedElementHandoffState(location.state)
  const statusProjection = useOpsxStatusSubscription({ change: changeId })
  const statusCurrent = statusProjection.authority.state === 'current'
  const { rootAction, launchApply, launchArchive } = useChangeOperatorLauncher({
    applyCurrent: statusCurrent,
  })

  const { data: status, isLoading, error } = statusProjection
  const { data: applyInstructions } = useOpsxApplyInstructionsSubscription({ change: changeId })
  const { data: files } = useChangeFilesSubscription(changeId)

  const handleComposeAction = useCallback(
    (actionId: OpsxComposeActionId, artifactId?: string) => {
      if (actionId === 'apply') {
        launchApply({ changeId, changeName: status?.changeName ?? changeId })
        return
      }
      const href = buildOpsxComposeHref({
        action: actionId,
        changeId,
        artifactId,
      })
      vtNavController.activatePop(href)
    },
    [changeId, launchApply, status?.changeName]
  )

  const handleVerify = useCallback(() => {
    vtNavController.activatePop(`/opsx-verify?change=${encodeURIComponent(changeId)}`)
  }, [changeId])

  const handleArchive = useCallback(() => {
    launchArchive({ changeId, changeName: status?.changeName ?? changeId })
  }, [changeId, launchArchive, status?.changeName])

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
  const actionDisabled = rootAction.disabled || !statusCurrent
  const actionDisabledReason =
    rootAction.message ??
    (!statusCurrent ? 'Change status is refreshing; actions remain read-only.' : undefined)

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
            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  Error loading change: {error.message}
                </div>
              </div>
            ) : null}
            <RootActionNotice state={rootAction} />
            <ChangeContextEvidence
              status={status}
              references={rootAction.context?.references ?? []}
            />
            {applyInstructions ? (
              <>
                <ApplyProgressNotice
                  applyInstructionProgress={applyInstructions.applyInstructionProgress}
                />
                <OperationInputs
                  title="Apply inputs"
                  context={applyInstructions.context}
                  operationGuidance={applyInstructions.operationGuidance}
                />
              </>
            ) : null}
            <ChangeCommandBar
              status={status}
              selectedArtifactId={selectedArtifactId}
              actionDisabled={actionDisabled}
              actionDisabledReason={actionDisabledReason}
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
