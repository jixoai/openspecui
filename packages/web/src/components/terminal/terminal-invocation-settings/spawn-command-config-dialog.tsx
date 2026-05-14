import { ButtonGroup, type ButtonGroupOption } from '@/components/button-group'
import { Dialog } from '@/components/dialog'
import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import {
  fieldsToTerminalCommandParameters,
  getTerminalCommandDefaultValues,
  renderTerminalSpawnCommandLine,
  type TerminalCommandBuilder,
  type TerminalCommandBuilderPart,
  type TerminalCommandField,
  type TerminalCommandFieldValue,
  type TerminalShellProfile,
  type TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createCustomId, formatBuilderSummary, toFieldId } from './helpers'

interface SpawnCommandConfigDialogProps {
  open: boolean
  command: TerminalSpawnCommand | null
  shellProfiles: readonly TerminalShellProfile[]
  onClose: () => void
  onSave: (command: TerminalSpawnCommand) => void
}

type EditableFieldType = TerminalCommandField['type']

interface EditableField {
  key: string
  id: string
  label: string
  type: EditableFieldType
  description: string
  defaultValue: string | boolean
  options: string
  required: boolean
  advanced: boolean
}

interface EditableBuilderPart {
  key: string
  kind: TerminalCommandBuilderPart['kind']
  value: string
  fieldId: string
  flag: string
  prefix: string
  omitWhenEmpty: boolean
}

const inputClassName =
  'bg-background border-border text-foreground focus:ring-primary rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1'
const fieldLabelClassName = 'flex min-w-0 flex-col gap-1 text-xs font-medium'
const primaryButtonClassName =
  'bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const destructiveButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50'

const FIELD_TYPE_OPTIONS: SelectOption<EditableFieldType>[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
]

const BUILDER_PART_OPTIONS: SelectOption<EditableBuilderPart['kind']>[] = [
  { value: 'literal', label: 'Literal' },
  { value: 'field', label: 'Field' },
  { value: 'booleanFlag', label: 'Boolean Flag' },
]

const BUILDER_KIND_OPTIONS = [
  { value: 'argv', label: 'argv' },
  { value: 'shellLine', label: 'shellLine' },
] satisfies ButtonGroupOption<TerminalCommandBuilder['kind']>[]

let editableKeyCounter = 0

function createEditableKey(prefix: string): string {
  editableKeyCounter += 1
  return `${prefix}:${editableKeyCounter}`
}

function fieldToEditable(field: TerminalCommandField): EditableField {
  return {
    key: createEditableKey('field'),
    id: field.id,
    label: field.label,
    type: field.type,
    description: field.description ?? field.placeholder ?? '',
    defaultValue:
      typeof field.defaultValue === 'boolean'
        ? field.defaultValue
        : typeof field.defaultValue === 'string'
          ? field.defaultValue
          : field.type === 'boolean'
            ? false
            : '',
    options: field.options.join(', '),
    required: field.required,
    advanced: field.advanced,
  }
}

function editableToField(field: EditableField): TerminalCommandField {
  const options = field.options
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean)
  return {
    id: toFieldId(field.id || field.label),
    label: field.label.trim() || field.id,
    type: field.type,
    description: field.description.trim() || undefined,
    defaultValue:
      field.type === 'boolean'
        ? field.defaultValue === true
        : typeof field.defaultValue === 'string'
          ? field.defaultValue
          : '',
    options,
    required: field.required,
    advanced: field.advanced,
  }
}

function builderPartToEditable(part: TerminalCommandBuilderPart): EditableBuilderPart {
  if (part.kind === 'literal') {
    return {
      key: createEditableKey('part'),
      kind: 'literal',
      value: part.value,
      fieldId: '',
      flag: '',
      prefix: '',
      omitWhenEmpty: true,
    }
  }
  if (part.kind === 'booleanFlag') {
    return {
      key: createEditableKey('part'),
      kind: 'booleanFlag',
      value: '',
      fieldId: part.fieldId,
      flag: part.flag,
      prefix: '',
      omitWhenEmpty: true,
    }
  }
  return {
    key: createEditableKey('part'),
    kind: 'field',
    value: '',
    fieldId: part.fieldId,
    flag: '',
    prefix: part.prefix,
    omitWhenEmpty: part.omitWhenEmpty,
  }
}

function editableToBuilderPart(part: EditableBuilderPart): TerminalCommandBuilderPart | null {
  if (part.kind === 'literal') {
    const value = part.value.trim()
    return value ? { kind: 'literal', value } : null
  }
  if (part.kind === 'booleanFlag') {
    const fieldId = part.fieldId.trim()
    const flag = part.flag.trim()
    return fieldId && flag ? { kind: 'booleanFlag', fieldId, flag } : null
  }
  const fieldId = part.fieldId.trim()
  return fieldId
    ? { kind: 'field', fieldId, prefix: part.prefix, omitWhenEmpty: part.omitWhenEmpty }
    : null
}

function makeDefaultFields(command: TerminalSpawnCommand | null): EditableField[] {
  if (command?.fields.length) return command.fields.map(fieldToEditable)
  return [
    {
      key: createEditableKey('field'),
      id: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      description: 'Prompt',
      defaultValue: '',
      options: '',
      required: false,
      advanced: false,
    },
  ]
}

function makeDefaultBuilderParts(command: TerminalSpawnCommand | null): EditableBuilderPart[] {
  if (command?.builder?.kind === 'argv') {
    return command.builder.parts.map(builderPartToEditable)
  }
  if (command?.builder?.kind === 'shellLine') return []
  if (command) {
    return [
      builderPartToEditable({ kind: 'literal', value: command.command }),
      ...command.args.map((arg) => builderPartToEditable(arg)),
    ]
  }
  return [
    builderPartToEditable({ kind: 'literal', value: 'claude' }),
    builderPartToEditable({ kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true }),
  ]
}

function makeSampleValues(
  fields: readonly TerminalCommandField[]
): Record<string, TerminalCommandFieldValue> {
  const values: Record<string, TerminalCommandFieldValue> = {}
  for (const field of fields) {
    if (field.type === 'boolean') {
      values[field.id] = field.defaultValue === true
    } else if (typeof field.defaultValue === 'string' && field.defaultValue.length > 0) {
      values[field.id] = field.defaultValue
    } else if (field.type === 'select') {
      values[field.id] = field.options[0] ?? ''
    } else {
      values[field.id] = field.id === 'prompt' ? 'Example prompt' : `example-${field.id}`
    }
  }
  return values
}

export function SpawnCommandConfigDialog({
  open,
  command,
  shellProfiles,
  onClose,
  onSave,
}: SpawnCommandConfigDialogProps) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [shellProfileId, setShellProfileId] = useState('')
  const [builderKind, setBuilderKind] = useState<TerminalCommandBuilder['kind']>('argv')
  const [shellLineTemplate, setShellLineTemplate] = useState('')
  const [fields, setFields] = useState<EditableField[]>(makeDefaultFields(null))
  const [parts, setParts] = useState<EditableBuilderPart[]>(makeDefaultBuilderParts(null))

  useEffect(() => {
    if (!open) return
    setLabel(command?.label ?? '')
    setDescription(command?.description ?? '')
    setShellProfileId(command?.shellProfileId ?? '')
    setBuilderKind(command?.builder?.kind ?? 'argv')
    setShellLineTemplate(command?.builder?.kind === 'shellLine' ? command.builder.template : '')
    setFields(makeDefaultFields(command))
    setParts(makeDefaultBuilderParts(command))
  }, [command, open])

  const normalizedFields = useMemo(() => fields.map(editableToField), [fields])
  const parameters = useMemo(
    () => fieldsToTerminalCommandParameters(normalizedFields),
    [normalizedFields]
  )
  const builder = useMemo<TerminalCommandBuilder>(() => {
    if (builderKind === 'shellLine') {
      return { kind: 'shellLine', template: shellLineTemplate }
    }
    return {
      kind: 'argv',
      parts: parts.map(editableToBuilderPart).filter((part) => part !== null),
    }
  }, [builderKind, parts, shellLineTemplate])
  const executable = useMemo(() => {
    if (builder.kind === 'argv') {
      const literal = builder.parts.find((part) => part.kind === 'literal')
      return literal?.kind === 'literal' ? literal.value : 'command'
    }
    return shellLineTemplate.trim().split(/\s+/)[0] || 'command'
  }, [builder, shellLineTemplate])
  const selectedShell = useMemo(
    () => shellProfiles.find((shell) => shell.id === shellProfileId),
    [shellProfileId, shellProfiles]
  )
  const shellOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: '', label: 'Default shell' },
      ...shellProfiles.map((shell) => ({
        value: shell.id,
        label: shell.label,
      })),
    ],
    [shellProfiles]
  )
  const fieldOptions = useMemo<SelectOption<string>[]>(
    () =>
      normalizedFields.map((field) => ({
        value: field.id,
        label: field.label,
      })),
    [normalizedFields]
  )
  const isBuilderValid =
    builder.kind === 'argv' ? builder.parts.length > 0 : builder.template.trim().length > 0
  const previewCommand = useMemo<TerminalSpawnCommand>(
    () => ({
      id: command?.id ?? 'preview',
      label: label.trim() || executable,
      description: description.trim() || undefined,
      command: executable,
      args: [],
      fields: normalizedFields,
      parameters,
      builder,
      shellProfileId: shellProfileId || undefined,
      source: 'custom',
    }),
    [
      builder,
      command?.id,
      description,
      executable,
      label,
      normalizedFields,
      parameters,
      shellProfileId,
    ]
  )
  const previewLine = useMemo(() => {
    const values = {
      ...getTerminalCommandDefaultValues(previewCommand),
      ...makeSampleValues(normalizedFields),
    }
    return renderTerminalSpawnCommandLine({
      command: previewCommand,
      values,
      quoteStyle: selectedShell?.quoteStyle ?? 'posix',
    })
  }, [normalizedFields, previewCommand, selectedShell?.quoteStyle])

  const addField = () => {
    const nextIndex = fields.length + 1
    setFields((current) => [
      ...current,
      {
        key: createEditableKey('field'),
        id: `arg${nextIndex}`,
        label: `Arg ${nextIndex}`,
        type: 'text',
        description: '',
        defaultValue: '',
        options: '',
        required: false,
        advanced: false,
      },
    ])
  }

  const addPart = (kind: EditableBuilderPart['kind']) => {
    if (kind === 'booleanFlag') {
      const existingBooleanField = normalizedFields.find((field) => field.type === 'boolean')
      const fieldId = existingBooleanField?.id ?? `flag${fields.length + 1}`
      if (!existingBooleanField) {
        setFields((current) => [
          ...current,
          {
            key: createEditableKey('field'),
            id: fieldId,
            label: 'Flag Enabled',
            type: 'boolean',
            description: '',
            defaultValue: false,
            options: '',
            required: false,
            advanced: false,
          },
        ])
      }
      setParts((current) => [
        ...current,
        {
          key: createEditableKey('part'),
          kind,
          value: '',
          fieldId,
          flag: '--flag',
          prefix: '',
          omitWhenEmpty: true,
        },
      ])
      return
    }
    setParts((current) => [
      ...current,
      {
        key: createEditableKey('part'),
        kind,
        value: kind === 'literal' ? 'literal' : '',
        fieldId: normalizedFields[0]?.id ?? '',
        flag: '',
        prefix: '',
        omitWhenEmpty: true,
      },
    ])
  }

  const handleSave = () => {
    const trimmedLabel = label.trim() || executable
    if (!trimmedLabel || !isBuilderValid) return
    onSave({
      id: command?.id ?? createCustomId('command', trimmedLabel),
      label: trimmedLabel,
      description: description.trim() || undefined,
      command: executable,
      args: [],
      fields: normalizedFields,
      parameters,
      builder,
      shellProfileId: shellProfileId || undefined,
      source: 'custom',
    })
    onClose()
  }

  if (!open) return null

  return (
    <Dialog
      open={open}
      title={
        <>
          {command ? (
            <Save className="text-primary h-4 w-4" />
          ) : (
            <Plus className="text-primary h-4 w-4" />
          )}
          <span>{command ? 'Edit Command' : 'Add Command'}</span>
        </>
      }
      onClose={onClose}
      className="max-w-4xl"
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
            disabled={!isBuilderValid}
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {command ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {command ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
            Label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Command label"
              className={inputClassName}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
            Shell
            <Select
              value={shellProfileId}
              options={shellOptions}
              onValueChange={setShellProfileId}
              ariaLabel="Shell"
              className={inputClassName}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium md:col-span-2">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
              className={inputClassName}
            />
          </label>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Parameters</h3>
            <button type="button" onClick={addField} className={primaryButtonClassName}>
              <Plus className="h-3.5 w-3.5" />
              Add Parameter
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.key} className="border-border rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-muted-foreground text-[11px] font-medium uppercase">
                    Parameter {index + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={field.advanced}
                        onCheckedChange={(checked) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, advanced: checked } : item
                            )
                          )
                        }
                      />
                      Advanced
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFields((current) =>
                          current.filter((_item, itemIndex) => itemIndex !== index)
                        )
                      }
                      className={destructiveButtonClassName}
                      aria-label={`Remove ${field.label || field.id}`}
                      title={`Remove ${field.label || field.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
                  <label className={fieldLabelClassName}>
                    Field
                    <input
                      value={field.id}
                      onChange={(event) => {
                        const previousFieldId = toFieldId(field.id || field.label)
                        const nextRawFieldId = event.target.value
                        const nextFieldId = toFieldId(nextRawFieldId || field.label)
                        setFields((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, id: nextRawFieldId } : item
                          )
                        )
                        if (previousFieldId !== nextFieldId) {
                          setParts((current) =>
                            current.map((item) =>
                              item.fieldId === previousFieldId
                                ? { ...item, fieldId: nextFieldId }
                                : item
                            )
                          )
                        }
                      }}
                      placeholder="fieldId"
                      className={inputClassName}
                    />
                  </label>
                  <label className={fieldLabelClassName}>
                    Title
                    <input
                      value={field.label}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Label"
                      className={inputClassName}
                    />
                  </label>
                  <label className={`${fieldLabelClassName} md:col-span-2`}>
                    Description
                    <input
                      value={field.description}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Shown below the rendered field"
                      className={inputClassName}
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_160px]">
                  <label className={fieldLabelClassName}>
                    Control Type
                    <Select
                      value={field.type}
                      options={FIELD_TYPE_OPTIONS}
                      onValueChange={(nextType) =>
                        setFields((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  type: nextType,
                                  defaultValue:
                                    nextType === 'boolean' ? false : String(item.defaultValue),
                                }
                              : item
                          )
                        )
                      }
                      ariaLabel={`Control Type for ${field.label || field.id}`}
                      className={inputClassName}
                    />
                  </label>
                  {field.type === 'textarea' ? (
                    <label className={fieldLabelClassName}>
                      Default Value
                      <textarea
                        value={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
                        onChange={(event) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, defaultValue: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="Default text"
                        rows={3}
                        className={inputClassName}
                      />
                    </label>
                  ) : field.type === 'boolean' ? (
                    <label className={fieldLabelClassName}>
                      Default Value
                      <Select
                        value={field.defaultValue === true ? 'true' : 'false'}
                        options={[
                          { value: 'false', label: 'false' },
                          { value: 'true', label: 'true' },
                        ]}
                        onValueChange={(nextValue) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, defaultValue: nextValue === 'true' }
                                : item
                            )
                          )
                        }
                        ariaLabel={`Default Value for ${field.label || field.id}`}
                        className={inputClassName}
                      />
                    </label>
                  ) : (
                    <label className={fieldLabelClassName}>
                      Default Value
                      <input
                        value={typeof field.defaultValue === 'string' ? field.defaultValue : ''}
                        onChange={(event) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, defaultValue: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder={field.type === 'select' ? 'Default option' : 'Default value'}
                        className={inputClassName}
                      />
                    </label>
                  )}
                  <label className={fieldLabelClassName}>
                    Required
                    <span className="border-border flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
                      <span>Required</span>
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, required: checked } : item
                            )
                          )
                        }
                      />
                    </span>
                  </label>
                </div>

                {field.type === 'select' && (
                  <div className="mt-3">
                    <label className={fieldLabelClassName}>
                      Select Options
                      <input
                        value={field.options}
                        onChange={(event) =>
                          setFields((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, options: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Option A, Option B"
                        className={inputClassName}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Builder</h3>
            <ButtonGroup<TerminalCommandBuilder['kind']>
              value={builderKind}
              onChange={setBuilderKind}
              options={BUILDER_KIND_OPTIONS}
            />
          </div>

          {builderKind === 'shellLine' ? (
            <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">
              Template
              <textarea
                value={shellLineTemplate}
                onChange={(event) => setShellLineTemplate(event.target.value)}
                placeholder="claude {{prompt}}"
                rows={4}
                className={inputClassName}
              />
            </label>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addPart('literal')}
                  className={primaryButtonClassName}
                >
                  Add Literal
                </button>
                <button
                  type="button"
                  onClick={() => addPart('field')}
                  className={primaryButtonClassName}
                >
                  Add Field
                </button>
                <button
                  type="button"
                  onClick={() => addPart('booleanFlag')}
                  className={primaryButtonClassName}
                >
                  Add Boolean Flag
                </button>
              </div>
              {parts.map((part, index) => (
                <div
                  key={part.key}
                  className="border-border grid items-end gap-3 rounded-md border p-3 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <div className="text-muted-foreground text-[11px] font-medium uppercase md:col-span-4">
                    Builder Part {index + 1}
                  </div>
                  <label className={fieldLabelClassName}>
                    Part Type
                    <Select
                      value={part.kind}
                      options={BUILDER_PART_OPTIONS}
                      onValueChange={(nextKind) =>
                        setParts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  kind: nextKind,
                                }
                              : item
                          )
                        )
                      }
                      ariaLabel={`Part Type for builder part ${index + 1}`}
                      className={inputClassName}
                    />
                  </label>
                  {part.kind === 'literal' ? (
                    <label className={fieldLabelClassName}>
                      Literal Value
                      <input
                        value={part.value}
                        onChange={(event) =>
                          setParts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, value: event.target.value } : item
                            )
                          )
                        }
                        placeholder="claude"
                        className={inputClassName}
                      />
                    </label>
                  ) : (
                    <label className={fieldLabelClassName}>
                      Source Field
                      <Select
                        value={part.fieldId}
                        options={fieldOptions}
                        onValueChange={(fieldId) =>
                          setParts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, fieldId } : item
                            )
                          )
                        }
                        ariaLabel={`Source Field for builder part ${index + 1}`}
                        className={inputClassName}
                      />
                    </label>
                  )}
                  {part.kind === 'booleanFlag' ? (
                    <label className={fieldLabelClassName}>
                      Flag Token
                      <input
                        value={part.flag}
                        onChange={(event) =>
                          setParts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, flag: event.target.value } : item
                            )
                          )
                        }
                        placeholder="--flag"
                        className={inputClassName}
                      />
                    </label>
                  ) : part.kind === 'field' ? (
                    <label className={fieldLabelClassName}>
                      Prefix
                      <input
                        value={part.prefix}
                        onChange={(event) =>
                          setParts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, prefix: event.target.value } : item
                            )
                          )
                        }
                        placeholder="Prefix"
                        className={inputClassName}
                      />
                    </label>
                  ) : (
                    <div />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setParts((current) =>
                        current.filter((_item, itemIndex) => itemIndex !== index)
                      )
                    }
                    className={destructiveButtonClassName}
                    aria-label={`Remove builder part ${index + 1}`}
                    title={`Remove builder part ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="bg-muted/30 border-border rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-1">Preview:</span>
          <code className="whitespace-pre-wrap break-words">{previewLine}</code>
          <div className="text-muted-foreground mt-1">{formatBuilderSummary(previewCommand)}</div>
        </div>
      </div>
    </Dialog>
  )
}
