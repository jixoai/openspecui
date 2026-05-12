import { terminalInvocationConfigStore } from '@/lib/terminal-invocation-config'
import type {
  TerminalShellProfile,
  TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatBuilderSummary } from './helpers'
import { SpawnCommandConfigDialog } from './spawn-command-config-dialog'

interface SpawnCommandSettingsProps {
  spawnCommands: TerminalSpawnCommand[]
  shellProfiles: readonly TerminalShellProfile[]
}

export function SpawnCommandSettings({ spawnCommands, shellProfiles }: SpawnCommandSettingsProps) {
  const [editingCommand, setEditingCommand] = useState<TerminalSpawnCommand | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openAddDialog = () => {
    setEditingCommand(null)
    setDialogOpen(true)
  }

  const editCommand = (command: TerminalSpawnCommand) => {
    setEditingCommand(command)
    setDialogOpen(true)
  }

  const saveCommand = (command: TerminalSpawnCommand) => {
    terminalInvocationConfigStore.upsertCustomSpawnCommand(command)
  }

  return (
    <div className="border-border/60 space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Spawn Commands</h3>
        <button
          type="button"
          onClick={openAddDialog}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Command
        </button>
      </div>

      <div className="border-border divide-border overflow-hidden rounded-md border">
        {spawnCommands.map((command) => {
          const selectedShell = shellProfiles.find((shell) => shell.id === command.shellProfileId)
          return (
            <div
              key={command.id}
              className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{command.label}</span>
                  <span className="text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] uppercase">
                    {command.source}
                  </span>
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {formatBuilderSummary(command)}
                  {selectedShell ? ` · ${selectedShell.label}` : ' · Default shell'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => editCommand(command)}
                  className="hover:bg-muted rounded p-1"
                  aria-label={`Edit ${command.label}`}
                  title={`Edit ${command.label}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {command.source === 'custom' && (
                  <button
                    type="button"
                    onClick={() =>
                      terminalInvocationConfigStore.removeCustomSpawnCommand(command.id)
                    }
                    className="inline-flex items-center justify-center rounded bg-red-600 p-1 text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    aria-label={`Remove ${command.label}`}
                    title={`Remove ${command.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <SpawnCommandConfigDialog
        open={dialogOpen}
        command={editingCommand}
        shellProfiles={shellProfiles}
        onClose={() => setDialogOpen(false)}
        onSave={saveCommand}
      />
    </div>
  )
}
