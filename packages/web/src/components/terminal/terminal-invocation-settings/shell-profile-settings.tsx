import { terminalInvocationConfigStore } from '@/lib/terminal-invocation-config'
import type {
  TerminalShellDefaults,
  TerminalShellProfile,
} from '@openspecui/core/terminal-invocation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ShellProfileDialog } from './shell-profile-dialog'

interface ShellProfileSettingsProps {
  shellDefaults: TerminalShellDefaults
  shellProfiles: TerminalShellProfile[]
  defaultShellProfile: TerminalShellProfile
}

export function ShellProfileSettings({
  shellDefaults,
  shellProfiles,
  defaultShellProfile,
}: ShellProfileSettingsProps) {
  const [editingShell, setEditingShell] = useState<TerminalShellProfile | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openAddDialog = () => {
    setEditingShell(null)
    setDialogOpen(true)
  }

  const editShell = (shell: TerminalShellProfile) => {
    setEditingShell(shell)
    setDialogOpen(true)
  }

  const saveShell = (shell: TerminalShellProfile) => {
    terminalInvocationConfigStore.upsertCustomShellProfile(shell)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Shells</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Effective platform default: <code>{shellDefaults.effectiveDefaultShell.command}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={openAddDialog}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Shell
        </button>
      </div>

      <div className="border-border divide-border overflow-hidden rounded-md border">
        {shellProfiles.map((shell) => {
          const isDefault = shell.id === defaultShellProfile.id
          return (
            <div
              key={shell.id}
              className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{shell.label}</span>
                  <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] uppercase">
                    {shell.source}
                  </span>
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {shell.command}
                  {shell.args.length > 0 ? ` ${shell.args.join(' ')}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isDefault ? (
                  <span className="bg-primary/10 text-primary rounded px-2 py-1 text-[11px] font-medium">
                    Default
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => terminalInvocationConfigStore.setDefaultShellProfileId(shell.id)}
                    className="border-border hover:bg-muted rounded border px-2 py-1 text-[11px] font-medium"
                  >
                    Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => editShell(shell)}
                  className="hover:bg-muted rounded p-1"
                  aria-label={`Edit ${shell.label}`}
                  title={`Edit ${shell.label}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {shell.source === 'custom' && (
                  <button
                    type="button"
                    onClick={() => terminalInvocationConfigStore.removeCustomShellProfile(shell.id)}
                    className="inline-flex items-center justify-center rounded bg-red-600 p-1 text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    aria-label={`Remove ${shell.label}`}
                    title={`Remove ${shell.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ShellProfileDialog
        open={dialogOpen}
        shell={editingShell}
        shellDefaults={shellDefaults}
        onClose={() => setDialogOpen(false)}
        onSave={saveShell}
      />
    </div>
  )
}
