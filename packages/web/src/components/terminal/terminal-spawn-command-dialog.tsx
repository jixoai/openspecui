import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import { useTerminalContext } from '@/lib/terminal-context'
import { useTerminalInvocationConfig } from '@/lib/use-terminal-invocation-config'
import {
  getTerminalCommandDefaultValues,
  getTerminalCommandParameters,
  renderTerminalSpawnCommandLine,
  type TerminalCommandFieldValues,
  type TerminalCommandJsonSchema,
  type TerminalCommandJsonSchemaProperty,
  type TerminalCommandParameters,
  type TerminalShellProfile,
  type TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { Rocket } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { TerminalCommandForm } from './terminal-command-form'

interface TerminalSpawnCommandDialogProps {
  open: boolean
  command: TerminalSpawnCommand | null
  presetValues?: TerminalCommandFieldValues
  onClose: () => void
  onCreated?: (sessionId: string) => void
}

function getShellById(
  shellProfiles: readonly TerminalShellProfile[],
  defaultShellProfile: TerminalShellProfile,
  id: string | undefined
): TerminalShellProfile {
  return shellProfiles.find((profile) => profile.id === id) ?? defaultShellProfile
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAdvancedField(uiSchemaEntry: unknown): boolean {
  return isRecord(uiSchemaEntry) && uiSchemaEntry['ui:advanced'] === true
}

function filterTerminalCommandParameters(
  parameters: TerminalCommandParameters,
  includeAdvanced: boolean
): TerminalCommandParameters {
  if (includeAdvanced) return parameters

  const properties: Record<string, TerminalCommandJsonSchemaProperty> = {}
  const uiSchema: Record<string, Record<string, unknown>> = {}
  for (const [fieldId, property] of Object.entries(parameters.schema.properties)) {
    if (isAdvancedField(parameters.uiSchema[fieldId])) continue
    properties[fieldId] = property
    const fieldUiSchema = parameters.uiSchema[fieldId]
    if (isRecord(fieldUiSchema)) {
      uiSchema[fieldId] = fieldUiSchema
    }
  }

  return {
    schema: {
      ...parameters.schema,
      properties,
      required: parameters.schema.required.filter((fieldId) => fieldId in properties),
    } satisfies TerminalCommandJsonSchema,
    uiSchema,
  }
}

function hasAdvancedFields(parameters: TerminalCommandParameters): boolean {
  return Object.values(parameters.uiSchema).some(isAdvancedField)
}

export function TerminalSpawnCommandDialog({
  open,
  command,
  presetValues,
  onClose,
  onCreated,
}: TerminalSpawnCommandDialogProps) {
  const { createShellSession } = useTerminalContext()
  const { shellProfiles, defaultShellProfile } = useTerminalInvocationConfig()
  const [values, setValues] = useState<TerminalCommandFieldValues>({})
  const [shellProfileId, setShellProfileId] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!command) return
    setValues(getTerminalCommandDefaultValues(command, presetValues))
    setShellProfileId(command.shellProfileId ?? '')
    setShowAdvanced(false)
  }, [command, presetValues])

  const selectedShell = useMemo(
    () =>
      getShellById(shellProfiles, defaultShellProfile, shellProfileId || command?.shellProfileId),
    [command?.shellProfileId, defaultShellProfile, shellProfileId, shellProfiles]
  )

  const commandLine = useMemo(() => {
    if (!command) return ''
    return renderTerminalSpawnCommandLine({
      command,
      values,
      quoteStyle: selectedShell.quoteStyle,
    })
  }, [command, selectedShell.quoteStyle, values])

  const parameters = useMemo(() => {
    if (!command) return null
    return getTerminalCommandParameters(command)
  }, [command])
  const hasAdvancedParameters = useMemo(
    () => (parameters ? hasAdvancedFields(parameters) : false),
    [parameters]
  )
  const visibleParameters = useMemo(
    () => (parameters ? filterTerminalCommandParameters(parameters, showAdvanced) : null),
    [parameters, showAdvanced]
  )

  const shellOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: '', label: `Default (${defaultShellProfile.label})` },
      ...shellProfiles.map((shell) => ({
        value: shell.id,
        label: shell.label,
      })),
    ],
    [defaultShellProfile.label, shellProfiles]
  )

  const handleCreate = () => {
    if (!command) return
    const sessionId = createShellSession(selectedShell, {
      label: command.label,
      initialInput: `${commandLine}\n`,
    })
    if (!sessionId) return
    onCreated?.(sessionId)
    onClose()
  }

  if (!command) {
    return (
      <Dialog open={open} title="Create terminal" onClose={onClose}>
        <div className="text-muted-foreground text-sm">Select a command first.</div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      title={
        <>
          <Rocket className="text-primary h-4 w-4" />
          <span>Create {command.label}</span>
        </>
      }
      onClose={onClose}
      className="max-w-xl"
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
            onClick={handleCreate}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
          >
            <Rocket className="h-3.5 w-3.5" />
            Create
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Shell
          <Select
            value={shellProfileId}
            options={shellOptions}
            onValueChange={setShellProfileId}
            ariaLabel="Shell"
          />
        </label>

        {hasAdvancedParameters && (
          <label className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
            <span className="font-medium">Show advanced options</span>
            <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
          </label>
        )}

        {visibleParameters && (
          <TerminalCommandForm
            schema={visibleParameters.schema}
            uiSchema={visibleParameters.uiSchema}
            values={values}
            onChange={(nextValues) =>
              setValues((currentValues) => ({
                ...currentValues,
                ...nextValues,
              }))
            }
          />
        )}

        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Command:</span>
          <code className="whitespace-pre-wrap break-words">{commandLine}</code>
        </div>
      </div>
    </Dialog>
  )
}
