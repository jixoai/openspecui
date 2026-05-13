import { Select, type SelectOption } from '@/components/select'
import { Switch } from '@/components/switch'
import type {
  TerminalCommandFieldValues,
  TerminalCommandJsonSchema,
} from '@openspecui/core/terminal-invocation'
import Form from '@rjsf/core'
import type {
  EnumOptionsType,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  UiSchema,
  WidgetProps,
} from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { useMemo } from 'react'

interface TerminalCommandFormProps {
  schema: TerminalCommandJsonSchema
  uiSchema?: UiSchema
  values: TerminalCommandFieldValues
  onChange: (values: TerminalCommandFieldValues) => void
}

const inputClassName =
  'bg-background border-border text-foreground focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1'

function toTerminalValues(value: unknown): TerminalCommandFieldValues {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: TerminalCommandFieldValues = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'boolean') {
      result[key] = item
    }
  }
  return result
}

function TextWidget(props: WidgetProps) {
  return (
    <input
      id={props.id}
      type="text"
      value={typeof props.value === 'string' ? props.value : ''}
      required={props.required}
      disabled={props.disabled || props.readonly}
      placeholder={props.placeholder}
      onChange={(event) => props.onChange(event.target.value)}
      onBlur={() => props.onBlur(props.id, props.value)}
      onFocus={() => props.onFocus(props.id, props.value)}
      className={inputClassName}
    />
  )
}

function TextareaWidget(props: WidgetProps) {
  return (
    <textarea
      id={props.id}
      value={typeof props.value === 'string' ? props.value : ''}
      required={props.required}
      disabled={props.disabled || props.readonly}
      placeholder={props.placeholder}
      rows={5}
      onChange={(event) => props.onChange(event.target.value)}
      onBlur={() => props.onBlur(props.id, props.value)}
      onFocus={() => props.onFocus(props.id, props.value)}
      className={inputClassName}
    />
  )
}

function CheckboxWidget(props: WidgetProps) {
  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
      </label>
      <Switch
        id={props.id}
        checked={props.value === true}
        required={props.required}
        disabled={props.disabled || props.readonly}
        onCheckedChange={(checked) => props.onChange(checked)}
        onBlur={() => props.onBlur(props.id, props.value)}
        onFocus={() => props.onFocus(props.id, props.value)}
      />
    </div>
  )
}

function SelectWidget(props: WidgetProps) {
  const options =
    (props.options.enumOptions as EnumOptionsType[] | undefined)?.map<SelectOption<string>>(
      (option) => ({
        value: String(option.value),
        label: option.label,
      })
    ) ?? []

  return (
    <Select
      id={props.id}
      value={typeof props.value === 'string' ? props.value : ''}
      options={options}
      required={props.required}
      disabled={props.disabled || props.readonly}
      onValueChange={(value) => props.onChange(value)}
      onBlur={() => props.onBlur(props.id, props.value)}
      onFocus={() => props.onFocus(props.id, props.value)}
      ariaLabel={props.label}
      className={inputClassName}
    />
  )
}

function FieldTemplate(props: FieldTemplateProps) {
  if (props.hidden) {
    return <div className="hidden">{props.children}</div>
  }
  const isBoolean = props.schema.type === 'boolean'
  if (isBoolean) {
    return (
      <div className="space-y-1">
        {props.children}
        {props.rawDescription && (
          <p className="text-muted-foreground text-xs">{props.rawDescription}</p>
        )}
        {props.errors}
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs font-medium">
      <label htmlFor={props.id}>
        {props.label}
        {props.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {props.children}
      {props.rawDescription && (
        <span className="text-muted-foreground text-xs">{props.rawDescription}</span>
      )}
      {props.errors}
    </div>
  )
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <div className="space-y-3">
      {props.properties.map((property: ObjectFieldTemplateProps['properties'][number]) => (
        <div key={property.name}>{property.content}</div>
      ))}
    </div>
  )
}

function ErrorListTemplate() {
  return null
}

export function TerminalCommandForm({
  schema,
  uiSchema,
  values,
  onChange,
}: TerminalCommandFormProps) {
  const templates = useMemo(
    () => ({
      FieldTemplate,
      ObjectFieldTemplate,
      ErrorListTemplate,
      ButtonTemplates: {
        SubmitButton: () => null,
      },
    }),
    []
  )

  const widgets = useMemo(
    () => ({
      TextWidget,
      TextareaWidget,
      CheckboxWidget,
      SelectWidget,
    }),
    []
  )

  return (
    <Form
      schema={schema as RJSFSchema}
      uiSchema={uiSchema}
      formData={values}
      validator={validator}
      liveValidate={false}
      omitExtraData
      templates={templates}
      widgets={widgets}
      onChange={(event) => onChange(toTerminalValues(event.formData))}
    />
  )
}
