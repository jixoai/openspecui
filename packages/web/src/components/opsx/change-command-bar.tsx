/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Project official change-scoped OPSX actions with shared objective applicability locks.
 * 2. Keep skipped artifacts outside Continue while delegating Archive authority to the dialog.
 * 3. Keep action-specific disabled reasons directly visible beside the command surface.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 * Original request (2026-07-28): Board and Change Detail must expose the same Apply boundary.
 * Original request (2026-08-03): Change Detail disabled reasons must remain in the default decision plane.
 */
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

type ComposeActionId = OpsxComposeActionId

interface ChangeCommandBarProps {
  status: ChangeStatus
  selectedArtifactId?: string
  actionDisabled?: boolean
  actionDisabledReason?: string
  onComposeAction: (actionId: ComposeActionId, artifactId?: string) => void
  onArchive: () => void
  onVerify: () => void
}

export function ChangeCommandBar({
  status,
  selectedArtifactId,
  actionDisabled = false,
  actionDisabledReason,
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
  const unavailableReasons = buttons.flatMap((button) =>
    button.disabled && button.hint ? [`${button.label}: ${button.hint}`] : []
  )

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((btn) => {
          const Icon = btn.icon
          return (
            <button
              key={btn.id}
              type="button"
              disabled={actionDisabled || btn.disabled}
              onClick={() =>
                btn.id === 'archive' ? onArchive() : onComposeAction(btn.id, btn.artifactId)
              }
              aria-label={btn.label}
              title={
                actionDisabled && actionDisabledReason
                  ? `${btn.label}: ${actionDisabledReason}`
                  : btn.hint
                    ? `${btn.label}: ${btn.hint}`
                    : btn.label
              }
              className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onVerify}
          disabled={actionDisabled}
          aria-label="Verify"
          title={
            actionDisabled && actionDisabledReason ? `Verify: ${actionDisabledReason}` : 'Verify'
          }
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Verify</span>
        </button>
      </div>
      {unavailableReasons.length > 0 ? (
        <p
          role="note"
          aria-label="Unavailable workflow actions"
          className="text-muted-foreground min-w-0 break-words text-xs"
        >
          Unavailable: {unavailableReasons.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}
