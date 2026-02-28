import type { OpsxComposeActionId } from '@/lib/opsx-compose'
import type { ChangeStatus } from '@openspecui/core'
import { Archive, CheckCircle, Play, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'

type ComposeActionId = OpsxComposeActionId

interface ChangeCommandBarProps {
  status: ChangeStatus
  selectedArtifactId?: string
  onComposeAction: (actionId: ComposeActionId, artifactId?: string) => void
  onVerify: () => void
  onRefresh: () => void
}

export function ChangeCommandBar({
  status,
  selectedArtifactId,
  onComposeAction,
  onVerify,
  onRefresh,
}: ChangeCommandBarProps) {
  const readyArtifact = status.artifacts.find((a) => a.status === 'ready')
  const doneSet = new Set(status.artifacts.filter((a) => a.status === 'done').map((a) => a.id))
  const missingApply = status.applyRequires.filter((id) => !doneSet.has(id))

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
        status.artifacts.find((a) => a.id === selectedArtifactId)?.status === 'blocked',
      hint: !selectedArtifactId ? 'select an artifact' : undefined,
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
      disabled: missingApply.length > 0,
      hint: missingApply.length > 0 ? `missing: ${missingApply.join(', ')}` : undefined,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      disabled: !status.isComplete,
      hint: !status.isComplete ? 'complete artifacts first' : undefined,
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((btn) => {
        const Icon = btn.icon
        return (
          <button
            key={btn.id}
            type="button"
            disabled={btn.disabled}
            onClick={() => onComposeAction(btn.id, btn.artifactId)}
            title={btn.hint}
            className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="h-3.5 w-3.5" />
            {btn.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onVerify}
        className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Verify
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  )
}
