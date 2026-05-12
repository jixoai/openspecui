import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import type {
  TerminalShellDefaults,
  TerminalShellProfile,
  TerminalShellQuoteStyle,
} from '@openspecui/core/terminal-invocation'
import { TERMINAL_SHELL_QUOTE_STYLE_VALUES } from '@openspecui/core/terminal-invocation'
import { Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createCustomId, formatCommaList, parseCommaList } from './helpers'

const QUOTE_STYLE_OPTIONS: SelectOption<TerminalShellQuoteStyle>[] =
  TERMINAL_SHELL_QUOTE_STYLE_VALUES.map((style) => ({
    value: style,
    label: style,
  }))

interface ShellProfileDialogProps {
  open: boolean
  shell: TerminalShellProfile | null
  shellDefaults: TerminalShellDefaults
  onClose: () => void
  onSave: (shell: TerminalShellProfile) => void
}

export function ShellProfileDialog({
  open,
  shell,
  shellDefaults,
  onClose,
  onSave,
}: ShellProfileDialogProps) {
  const [label, setLabel] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [quoteStyle, setQuoteStyle] = useState<TerminalShellQuoteStyle>('posix')

  useEffect(() => {
    if (!open) return
    setLabel(shell?.label ?? '')
    setCommand(shell?.command ?? '')
    setArgs(formatCommaList(shell?.args ?? []))
    setQuoteStyle(shell?.quoteStyle ?? 'posix')
  }, [open, shell])

  const handleSave = () => {
    const trimmedCommand = command.trim()
    if (!trimmedCommand) return
    const trimmedLabel = label.trim() || trimmedCommand
    onSave({
      id: shell?.id ?? createCustomId('shell', trimmedLabel),
      label: trimmedLabel,
      command: trimmedCommand,
      args: parseCommaList(args),
      source: 'custom',
      quoteStyle,
    })
    onClose()
  }

  if (!open) return null

  return (
    <Dialog
      open={open}
      title={
        <>
          {shell ? (
            <Save className="text-primary h-4 w-4" />
          ) : (
            <Plus className="text-primary h-4 w-4" />
          )}
          <span>{shell ? 'Edit Shell' : 'Add Shell'}</span>
        </>
      }
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!command.trim()}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shell ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {shell ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Shell label"
            className="bg-background border-border text-foreground focus:ring-primary rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Command
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={shellDefaults.effectiveDefaultShell.command}
            className="bg-background border-border text-foreground focus:ring-primary rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
            Args
            <input
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              placeholder="Shell args"
              className="bg-background border-border text-foreground focus:ring-primary rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Quote Style
            <Select
              value={quoteStyle}
              options={QUOTE_STYLE_OPTIONS}
              onValueChange={setQuoteStyle}
              ariaLabel="Quote Style"
            />
          </label>
        </div>
      </div>
    </Dialog>
  )
}
