/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Classify supported OpenSpec CLI mutations by their affected runtime facets.
 * 2. Keep read-only and unknown commands free from fabricated invalidation claims.
 * 3. Preserve one server-owned mapping for buffered and streaming execution paths.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import {
  OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS,
  type RuntimeInvalidationFacet,
} from '@openspecui/core'

const PROJECT_CONTEXT_FACETS = ['project', 'context'] as const
const PROJECT_SCHEMA_FACETS = ['project', 'context', 'schemas'] as const
const STORE_CONTEXT_FACETS = ['stores', 'context'] as const
const WORKSET_FACETS = ['worksets'] as const

const PROJECT_MUTATION_COMMANDS = new Set(['init', 'update', 'archive', 'new'])
const SCHEMA_MUTATION_COMMANDS = new Set(['fork', 'init'])
const CONFIG_MUTATION_COMMANDS = new Set(['edit', 'profile', 'reset', 'set', 'unset'])
const STORE_MUTATION_COMMANDS = new Set(['register', 'remove', 'setup', 'unregister'])
const WORKSET_MUTATION_COMMANDS = new Set(['create', 'remove'])
const MUTATION_COMMAND_FAMILIES = new Set([
  ...PROJECT_MUTATION_COMMANDS,
  'config',
  'schema',
  'store',
  'workset',
])

function findCommand(args: readonly string[]): string | null {
  return args.find((argument) => MUTATION_COMMAND_FAMILIES.has(argument)) ?? null
}

function findSubcommand(
  args: readonly string[],
  optionsWithValues: ReadonlySet<string> = new Set()
): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (optionsWithValues.has(argument)) {
      index += 1
      continue
    }
    if (argument.startsWith('-')) continue
    return argument
  }
  return null
}

/** Return the facets objectively affected by a supported OpenSpec CLI mutation. */
export function getOpenSpecMutationFacets(
  args: readonly string[]
): readonly RuntimeInvalidationFacet[] | null {
  if (args.includes('--help') || args.includes('-h')) return null
  const command = findCommand(args)
  if (!command) return null
  if (PROJECT_MUTATION_COMMANDS.has(command)) return PROJECT_CONTEXT_FACETS

  const commandArgs = args.slice(args.indexOf(command) + 1)
  const subcommand = findSubcommand(
    commandArgs,
    command === 'config' ? new Set(['--scope']) : undefined
  )
  if (command === 'schema' && subcommand && SCHEMA_MUTATION_COMMANDS.has(subcommand)) {
    return PROJECT_SCHEMA_FACETS
  }
  if (command === 'config' && subcommand && CONFIG_MUTATION_COMMANDS.has(subcommand)) {
    return OPEN_SPEC_DATA_HOME_INVALIDATION_FACETS
  }
  if (command === 'store' && subcommand && STORE_MUTATION_COMMANDS.has(subcommand)) {
    return STORE_CONTEXT_FACETS
  }
  if (command === 'workset' && subcommand && WORKSET_MUTATION_COMMANDS.has(subcommand)) {
    return WORKSET_FACETS
  }
  return null
}
