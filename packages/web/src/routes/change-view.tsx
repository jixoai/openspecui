/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Render schema-aware change artifacts and source files while retaining terminal status errors.
 * 2. Dispatch change workflows through routed compose/verify surfaces and the shared Operator launcher.
 * 3. Lock every change workflow action behind current Root Context and Status projection authority.
 * 4. Present Apply progress directly and expose project context/guidance through a Header Action Dialog.
 * 5. Keep compact Change facts in subtitle badges while routing complete CLI evidence through a dedicated tab.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Review request (2026-07-23): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Original request (2026-07-28): Board and Change Detail must use the same Operator owners.
 * Original request (2026-08-01): preserve OpenSpec 1.7 Apply operation inputs end to end.
 * Original request (2026-08-03): move complete Change evidence into a dedicated tab page.
 * Owner correction (2026-08-03): move Actions inline with the title, unify subtitle badges, and localize unavailable Tooltips.
 * Original request (2026-08-15): 刷新/解析中状态收敛为副标题行内的 shiny 徽章，不再占据 statusRegion 块。
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。" — the Evidence
 *   tab gains the 1.11-gated CLI MODIFIED-delta diff evidence beside the existing layers.
 */
import { ApplyProgressNotice } from '@/components/apply-progress-notice'
import { ArchivedValidationEvidence } from '@/components/archived-validation-evidence'
import {
  ChangeContextSummary,
  ChangeReferenceFailureNotice,
  type ChangeReferenceEvidence,
} from '@/components/change-context-summary'
import { ChangeDiffEvidence } from '@/components/change-diff-evidence'
import { ChangeEvidencePanel } from '@/components/change-evidence-panel'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { OperationInputsDialogAction } from '@/components/opsx/operation-inputs'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import { RootActionNotice } from '@/components/root-action-notice'
import { buildOpsxComposeHref, type OpsxComposeActionId } from '@/lib/opsx-compose'
import { useChangeOperatorLauncher } from '@/lib/use-change-operator-launcher'
import { useOpsxApplyInstructionsSubscription, useOpsxStatusSubscription } from '@/lib/use-opsx'
import { useChangeFilesSubscription } from '@/lib/use-subscription'
import { vtNavController } from '@/lib/view-transitions/navigation'
import { readSharedElementHandoffState } from '@/lib/view-transitions/shared-elements'
import { useLocation, useParams } from '@tanstack/react-router'
import { AlertCircle, FileSearch, GitBranch } from 'lucide-react'
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

  const isMissingChangeError =
    error?.message.includes(`Change '${changeId}' not found`) ||
    error?.message.includes(`Change "${changeId}" not found`)
  const rootFailureMessage =
    rootAction.status === 'blocked'
      ? [rootAction.message, ...rootAction.evidence].join('\n')
      : undefined
  const actionDisabled = rootAction.disabled || !statusCurrent
  const statusAuthorityMessage = !statusCurrent
    ? 'Change status is refreshing; actions remain read-only.'
    : undefined
  const actionDisabledReason = rootAction.message ?? statusAuthorityMessage
  const referenceEvidence = useMemo<ChangeReferenceEvidence>(() => {
    if (status?.provenance.kind === 'static') {
      return { state: 'unavailable', reason: 'static' }
    }
    if (!rootAction.context) {
      return { state: 'unavailable', reason: 'root-context' }
    }
    return {
      state: rootAction.status === 'ready' ? 'current' : 'retained',
      references: rootAction.context.references,
    }
  }, [rootAction.context, rootAction.status, status?.provenance.kind])
  const supplementaryTabs = useMemo(
    () =>
      status
        ? [
            {
              id: 'evidence',
              label: 'Evidence',
              icon: <FileSearch className="h-4 w-4" />,
              content: (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <ChangeEvidencePanel status={status} referenceEvidence={referenceEvidence} />
                  <ChangeDiffEvidence changeId={changeId} />
                  <ArchivedValidationEvidence />
                </div>
              ),
            },
          ]
        : [],
    [referenceEvidence, status]
  )
  const hasReferenceFailures =
    referenceEvidence.state !== 'unavailable' &&
    referenceEvidence.references.some((reference) =>
      reference.status.some((diagnostic) => diagnostic.severity === 'error')
    )
  const hasDirectStatus =
    Boolean(error) ||
    rootAction.status === 'blocked' ||
    hasReferenceFailures ||
    Boolean(applyInstructions?.applyInstructionProgress.divergence)

  return (
    <OpsxEntityDetailView
      entityId={changeId}
      sharedFamily="changes"
      backTo="/changes"
      backTitle="Back to Changes"
      icon={GitBranch}
      title={status?.changeName}
      subtitle={
        status ? (
          <ChangeContextSummary
            status={status}
            referenceEvidence={referenceEvidence}
            applyInstructionProgress={applyInstructions?.applyInstructionProgress ?? null}
            statusRefreshing={
              statusCurrent
                ? null
                : { label: 'Status refreshing', message: statusAuthorityMessage ?? '' }
            }
            rootChecking={
              rootAction.status === 'checking'
                ? { label: rootAction.title, message: rootAction.message }
                : null
            }
          />
        ) : undefined
      }
      headerActions={
        status ? (
          <ChangeCommandBar
            status={status}
            selectedArtifactId={selectedArtifactId}
            actionDisabled={actionDisabled}
            actionDisabledReason={actionDisabledReason}
            applyInputsAction={
              <OperationInputsDialogAction
                title="Apply inputs"
                context={applyInstructions?.context}
                operationGuidance={applyInstructions?.operationGuidance}
              />
            }
            onComposeAction={handleComposeAction}
            onArchive={handleArchive}
            onVerify={handleVerify}
          />
        ) : undefined
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
      supplementaryTabs={supplementaryTabs}
      statusRegion={
        status && hasDirectStatus ? (
          <div className="flex min-w-0 flex-col gap-2">
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
            <ChangeReferenceFailureNotice referenceEvidence={referenceEvidence} />
            {applyInstructions ? (
              <ApplyProgressNotice
                applyInstructionProgress={applyInstructions.applyInstructionProgress}
              />
            ) : null}
          </div>
        ) : null
      }
    />
  )
}
