import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
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
import { ChevronDown, Rocket } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
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
  predicate: (fieldId: string) => boolean
): TerminalCommandParameters {
  const properties: Record<string, TerminalCommandJsonSchemaProperty> = {}
  const uiSchema: Record<string, Record<string, unknown>> = {}
  for (const [fieldId, property] of Object.entries(parameters.schema.properties)) {
    if (!predicate(fieldId)) continue
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
  const advancedSectionId = useId()
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
  const basicParameters = useMemo(
    () =>
      parameters
        ? filterTerminalCommandParameters(
            parameters,
            (fieldId) => !isAdvancedField(parameters.uiSchema[fieldId])
          )
        : null,
    [parameters]
  )
  const advancedParameters = useMemo(
    () =>
      parameters
        ? filterTerminalCommandParameters(parameters, (fieldId) =>
            isAdvancedField(parameters.uiSchema[fieldId])
          )
        : null,
    [parameters]
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
      onDismissRequest={null}
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

        {basicParameters && (
          <TerminalCommandForm
            schema={basicParameters.schema}
            uiSchema={basicParameters.uiSchema}
            values={values}
            onChange={(nextValues) =>
              setValues((currentValues) => ({
                ...currentValues,
                ...nextValues,
              }))
            }
          />
        )}

        {hasAdvancedParameters && advancedParameters && (
          <section className="space-y-2">
            <button
              type="button"
              aria-expanded={showAdvanced}
              aria-controls={advancedSectionId}
              onClick={() => setShowAdvanced((current) => !current)}
              className="border-border hover:bg-muted/40 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors"
            >
              <span className="font-medium">Advanced options</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              id={advancedSectionId}
              aria-hidden={!showAdvanced}
              inert={!showAdvanced}
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                showAdvanced ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-primary/35 rounded-md border bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] p-3">
                  <TerminalCommandForm
                    schema={advancedParameters.schema}
                    uiSchema={advancedParameters.uiSchema}
                    values={values}
                    onChange={(nextValues) =>
                      setValues((currentValues) => ({
                        ...currentValues,
                        ...nextValues,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Command:</span>
          <code className="whitespace-pre-wrap break-words">{commandLine}</code>
        </div>
      </div>
    </Dialog>
  )
}
