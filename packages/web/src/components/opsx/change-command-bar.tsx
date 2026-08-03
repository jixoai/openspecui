/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Project official change-scoped OPSX actions with shared objective applicability locks.
 * 2. Keep skipped artifacts outside Continue while delegating Archive authority to the dialog.
 * 3. Attach action-specific disabled reasons to their corresponding button Tooltips.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 * Original request (2026-07-28): Board and Change Detail must expose the same Apply boundary.
 * Original request (2026-08-03): Change Detail disabled reasons must remain in the default decision plane.
 * Owner correction (2026-08-03): remove repeated Unavailable prose and localize each reason to its action Tooltip.
 */
import { Tooltip } from '@/components/tooltip'
import { getChangeApplyAvailability } from '@/lib/change-operator-availability'
import type { OpsxComposeActionId } from '@/lib/opsx-compose'
import type { ChangeStatus } from '@openspecui/core'
import {
  Archive,
  CheckCircle,
  GitCompareArrows,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

type ComposeActionId = OpsxComposeActionId

interface ChangeCommandBarProps {
  status: ChangeStatus
  selectedArtifactId?: string
  actionDisabled?: boolean
  actionDisabledReason?: string
  applyInputsAction?: ReactNode
  onComposeAction: (actionId: ComposeActionId, artifactId?: string) => void
  onArchive: () => void
  onVerify: () => void
}

export function ChangeCommandBar({
  status,
  selectedArtifactId,
  actionDisabled = false,
  actionDisabledReason,
  applyInputsAction,
  onComposeAction,
  onArchive,
  onVerify,
}: ChangeCommandBarProps) {
  const readyArtifact = status.artifacts.find((a) => a.status === 'ready')
  const selectedArtifact = status.artifacts.find((artifact) => artifact.id === selectedArtifactId)
  const applyAvailability = getChangeApplyAvailability(status)

  const buttons: Array<{
    id: ComposeActionId
    label: string
    icon: typeof Play
    artifactId?: string
    disabled: boolean
    hint?: string
  }> = [
    {
      id: 'continue',
      label: 'Continue',
      icon: Play,
      artifactId: selectedArtifactId,
      disabled:
        !selectedArtifactId ||
        !selectedArtifact ||
        ['blocked', 'skipped'].includes(selectedArtifact.status),
      hint: !selectedArtifactId
        ? 'select an artifact'
        : !selectedArtifact
          ? 'selected artifact is unavailable'
          : selectedArtifact.status === 'blocked'
            ? 'selected artifact is blocked'
            : selectedArtifact.status === 'skipped'
              ? 'selected artifact is intentionally skipped'
              : undefined,
    },
    {
      id: 'ff',
      label: 'Fast-forward',
      icon: Rocket,
      artifactId: readyArtifact?.id,
      disabled: !readyArtifact,
      hint: !readyArtifact ? 'no ready artifacts' : undefined,
    },
    {
      id: 'apply',
      label: 'Apply',
      icon: CheckCircle,
      disabled: !applyAvailability.available,
      hint:
        applyAvailability.missingArtifactIds.length > 0
          ? `missing: ${applyAvailability.missingArtifactIds.join(', ')}`
          : undefined,
    },
    {
      id: 'update',
      label: 'Update',
      icon: RefreshCw,
      disabled: false,
    },
    {
      id: 'sync',
      label: 'Sync',
      icon: GitCompareArrows,
      disabled: false,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      disabled: false,
    },
  ]
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {buttons.map((btn) => {
        const Icon = btn.icon
        const unavailableReason = actionDisabled
          ? actionDisabledReason
          : btn.disabled
            ? btn.hint
            : undefined
        return (
          <Fragment key={btn.id}>
            <Tooltip content={unavailableReason ? `${btn.label}: ${unavailableReason}` : btn.label}>
              <button
                type="button"
                disabled={actionDisabled || btn.disabled}
                onClick={() =>
                  btn.id === 'archive' ? onArchive() : onComposeAction(btn.id, btn.artifactId)
                }
                aria-label={btn.label}
                className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{btn.label}</span>
              </button>
            </Tooltip>
            {btn.id === 'apply' ? applyInputsAction : null}
          </Fragment>
        )
      })}
      <Tooltip
        content={
          actionDisabled && actionDisabledReason ? `Verify: ${actionDisabledReason}` : 'Verify'
        }
      >
        <button
          type="button"
          onClick={onVerify}
          disabled={actionDisabled}
          aria-label="Verify"
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Verify</span>
        </button>
      </Tooltip>
    </div>
  )
}
