import type { ChangeStatus } from '@openspecui/core'
import { Archive, CheckCircle, Play, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'

interface ChangeCommandBarProps {
  changeId: string
  status: ChangeStatus
  selectedArtifactId?: string
  onRunCommand: (command: string, args: string[]) => void
}

export function ChangeCommandBar({
  changeId,
  status,
  selectedArtifactId,
  onRunCommand,
}: ChangeCommandBarProps) {
  const readyArtifact = status.artifacts.find((a) => a.status === 'ready')
  const doneSet = new Set(status.artifacts.filter((a) => a.status === 'done').map((a) => a.id))
  const missingApply = status.applyRequires.filter((id) => !doneSet.has(id))

  const buttons: Array<{
    id: string
    label: string
    icon: typeof Play
    args: string[]
    disabled: boolean
    hint?: string
  }> = [
    {
      id: 'continue',
      label: 'Continue',
      icon: Play,
      args: selectedArtifactId
        ? ['instructions', selectedArtifactId, '--change', changeId]
        : [],
      disabled: !selectedArtifactId || status.artifacts.find((a) => a.id === selectedArtifactId)?.status === 'blocked',
      hint: !selectedArtifactId ? 'select an artifact' : undefined,
    },
    {
      id: 'ff',
      label: 'Fast-forward',
      icon: Rocket,
      args: readyArtifact
        ? ['instructions', readyArtifact.id, '--change', changeId]
        : [],
      disabled: !readyArtifact,
      hint: !readyArtifact ? 'no ready artifacts' : undefined,
    },
    {
      id: 'apply',
      label: 'Apply',
      icon: CheckCircle,
      args: ['instructions', 'apply', '--change', changeId],
      disabled: missingApply.length > 0,
      hint: missingApply.length > 0 ? `missing: ${missingApply.join(', ')}` : undefined,
    },
    {
      id: 'verify',
      label: 'Verify',
      icon: ShieldCheck,
      args: ['validate', '--type', 'change', '--strict', changeId],
      disabled: false,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      args: ['archive', '--yes', changeId],
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
            onClick={() => onRunCommand('openspec', btn.args)}
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
        onClick={() => onRunCommand('openspec', ['status', '--change', changeId])}
        className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  )
}
