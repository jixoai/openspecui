import type { TerminalSpawnCommand } from '@openspecui/core/terminal-invocation'

let customIdCounter = 0

export function createCustomId(kind: string, label: string): string {
  customIdCounter += 1
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `custom:${kind}:${slug || 'item'}:${Date.now()}:${customIdCounter}`
}

export function parseCommaList(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function formatCommaList(values: readonly string[]): string {
  return values.join(', ')
}

export function toFieldId(input: string): string {
  const slug = input
    .trim()
    .replace(/^-+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'value'
}

export function formatBuilderSummary(command: TerminalSpawnCommand): string {
  if (command.builder?.kind === 'shellLine') {
    return command.builder.template || command.command
  }
  if (command.builder?.kind === 'argv') {
    return command.builder.parts
      .map((part) => {
        if (part.kind === 'literal') return part.value
        if (part.kind === 'booleanFlag') return `${part.flag} when {{${part.fieldId}}}`
        return `${part.prefix}{{${part.fieldId}}}`
      })
      .join(' ')
  }
  return [
    command.command,
    ...command.args.map((arg) => (arg.kind === 'literal' ? arg.value : `{{${arg.fieldId}}}`)),
  ]
    .join(' ')
    .trim()
}
