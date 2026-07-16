/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Own the explicit read-only policy shared by generic buffered and streamed OpenSpec RPCs.
 * 2. Reject browser-selected roots and every command not positively identified as read-only.
 * 3. Keep application mutations behind typed Server owners, including strict Archive.
 *
 * Original request (2026-07-16): "Public OpenSpec execution cannot be secured by denying only the latest discovered subcommand."
 */

type ReadOnlyOptionKind = 'boolean' | 'value'

interface ReadOnlyOpenSpecCommandPolicy {
  path: readonly string[]
  positionals: readonly [minimum: number, maximum: number]
  options: Readonly<Record<string, ReadOnlyOptionKind>>
  exampleArgs: readonly string[]
}

/** Canonical OpenSpec 1.6 read-only argv shapes accepted by generic public execution. */
export const GENERIC_READ_ONLY_OPEN_SPEC_COMMAND_POLICIES = [
  {
    path: ['list'],
    positionals: [0, 0],
    options: {
      '--specs': 'boolean',
      '--changes': 'boolean',
      '--sort': 'value',
      '--json': 'boolean',
    },
    exampleArgs: ['list', '--specs', '--sort', 'name', '--json'],
  },
  {
    path: ['show'],
    positionals: [0, 1],
    options: {
      '--json': 'boolean',
      '--type': 'value',
      '--no-interactive': 'boolean',
      '--deltas-only': 'boolean',
      '--requirements-only': 'boolean',
      '--requirements': 'boolean',
      '--no-scenarios': 'boolean',
      '--requirement': 'value',
    },
    exampleArgs: ['show', 'demo', '--type', 'change', '--json'],
  },
  {
    path: ['validate'],
    positionals: [0, 1],
    options: {
      '--all': 'boolean',
      '--changes': 'boolean',
      '--specs': 'boolean',
      '--type': 'value',
      '--strict': 'boolean',
      '--json': 'boolean',
      '--concurrency': 'value',
      '--no-interactive': 'boolean',
    },
    exampleArgs: ['validate', 'demo', '--type', 'change', '--strict', '--json'],
  },
  {
    path: ['status'],
    positionals: [0, 0],
    options: { '--change': 'value', '--schema': 'value', '--json': 'boolean' },
    exampleArgs: ['status', '--change', 'demo', '--json'],
  },
  {
    path: ['instructions'],
    positionals: [0, 1],
    options: { '--change': 'value', '--schema': 'value', '--json': 'boolean' },
    exampleArgs: ['instructions', 'apply', '--change', 'demo', '--json'],
  },
  {
    path: ['templates'],
    positionals: [0, 0],
    options: { '--schema': 'value', '--json': 'boolean' },
    exampleArgs: ['templates', '--schema', 'spec-driven', '--json'],
  },
  {
    path: ['schemas'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['schemas', '--json'],
  },
  {
    path: ['schema', 'which'],
    positionals: [0, 1],
    options: { '--json': 'boolean', '--all': 'boolean' },
    exampleArgs: ['schema', 'which', 'spec-driven', '--json'],
  },
  {
    path: ['schema', 'validate'],
    positionals: [0, 1],
    options: { '--json': 'boolean', '--verbose': 'boolean' },
    exampleArgs: ['schema', 'validate', 'spec-driven', '--json'],
  },
  {
    path: ['store', 'list'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['store', 'list', '--json'],
  },
  {
    path: ['store', 'doctor'],
    positionals: [0, 1],
    options: { '--json': 'boolean' },
    exampleArgs: ['store', 'doctor', 'shared', '--json'],
  },
  {
    path: ['config', 'path'],
    positionals: [0, 0],
    options: {},
    exampleArgs: ['config', 'path'],
  },
  {
    path: ['config', 'list'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['config', 'list', '--json'],
  },
  {
    path: ['config', 'get'],
    positionals: [1, 1],
    options: {},
    exampleArgs: ['config', 'get', 'profile'],
  },
  {
    path: ['doctor'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['doctor', '--json'],
  },
  {
    path: ['context'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['context', '--json'],
  },
  {
    path: ['workset', 'list'],
    positionals: [0, 0],
    options: { '--json': 'boolean' },
    exampleArgs: ['workset', 'list', '--json'],
  },
] as const satisfies readonly ReadOnlyOpenSpecCommandPolicy[]

const ROOT_SELECTOR_PATTERN = /^--store(?:-path)?(?:=|$)/

function matchesReadOnlyCommandPolicy(
  args: readonly string[],
  policy: ReadOnlyOpenSpecCommandPolicy
): boolean {
  if (!policy.path.every((token, index) => args[index] === token)) return false

  let positionalCount = 0
  const tail = args.slice(policy.path.length)
  for (let index = 0; index < tail.length; index += 1) {
    const argument = tail[index]
    if (!argument.startsWith('-')) {
      positionalCount += 1
      continue
    }
    if (!argument.startsWith('--')) return false

    const separatorIndex = argument.indexOf('=')
    const optionName = separatorIndex === -1 ? argument : argument.slice(0, separatorIndex)
    const inlineValue = separatorIndex === -1 ? null : argument.slice(separatorIndex + 1)
    const optionKind = policy.options[optionName]
    if (!optionKind) return false
    if (optionKind === 'boolean') {
      if (inlineValue !== null) return false
      continue
    }
    if (inlineValue !== null) {
      if (inlineValue.length === 0) return false
      continue
    }

    const optionValue = tail[index + 1]
    if (!optionValue || optionValue.startsWith('-')) return false
    index += 1
  }

  const [minimumPositionals, maximumPositionals] = policy.positionals
  return positionalCount >= minimumPositionals && positionalCount <= maximumPositionals
}

function matchesReadOnlyCommand(args: readonly string[]): boolean {
  return GENERIC_READ_ONLY_OPEN_SPEC_COMMAND_POLICIES.some((policy) =>
    matchesReadOnlyCommandPolicy(args, policy)
  )
}

/** Reject mutation, unknown, non-canonical, and browser-root-selected generic OpenSpec argv. */
export function assertGenericOpenSpecCommandAllowed(args: readonly string[]): void {
  const browserSelectedRoot = args.find((argument) => ROOT_SELECTOR_PATTERN.test(argument))
  if (browserSelectedRoot) {
    throw new Error(
      `OpenSpec root selector ${browserSelectedRoot} is unavailable through generic execution; use a typed Server-owned procedure.`
    )
  }
  if (matchesReadOnlyCommand(args)) return
  throw new Error(
    'This OpenSpec command is unavailable through generic execution; only explicitly allowlisted read-only commands are supported. Use a typed Server-owned procedure for mutations.'
  )
}
