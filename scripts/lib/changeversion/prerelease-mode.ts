/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Parse explicit prerelease CLI intent and persisted Changesets state.
 * 2. Plan prerelease entry, continuation, and exit commands.
 * 3. Reject ambiguous or conflicting channel changes.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const PRERELEASE_TAG_PATTERN = /^[a-z][a-z0-9-]*$/

export type ChangeversionOptions = {
  exitPre: boolean
  preTag: null | string
}

export type ChangesetsPrereleaseState = {
  mode: 'exit' | 'pre'
  tag: string
}

export type PrereleaseModeAction =
  | { args: ['pre', 'enter', string]; kind: 'enter' }
  | { args: ['pre', 'exit']; kind: 'exit' }

type PrereleaseModeInput = {
  exitPre: boolean
  preTag: null | string
  state: ChangesetsPrereleaseState | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validatePrereleaseTag(tag: string): string {
  if (!PRERELEASE_TAG_PATTERN.test(tag) || tag === 'latest') {
    throw new Error(`Invalid prerelease channel '${tag}'. Use a lowercase npm tag such as 'beta'.`)
  }
  return tag
}

export function parseChangeversionOptions(processArgs: readonly string[]): ChangeversionOptions {
  const argv = yargs(hideBin([...processArgs]))
    .scriptName('changeversion')
    .option('pre', {
      description: 'Enter or continue a named Changesets prerelease channel.',
      type: 'string',
    })
    .option('exit-pre', {
      default: false,
      description: 'Exit the current Changesets prerelease channel before versioning.',
      type: 'boolean',
    })
    .strict()
    .help()
    .parseSync()

  return {
    exitPre: argv['exit-pre'],
    preTag: argv.pre ?? null,
  }
}

export function readChangesetsPrereleaseState(rootDir: string): ChangesetsPrereleaseState | null {
  const path = join(rootDir, '.changeset', 'pre.json')
  if (!existsSync(path)) return null

  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (
    !isRecord(parsed) ||
    (parsed.mode !== 'pre' && parsed.mode !== 'exit') ||
    typeof parsed.tag !== 'string'
  ) {
    throw new Error(`Invalid Changesets prerelease state at ${path}`)
  }

  return { mode: parsed.mode, tag: validatePrereleaseTag(parsed.tag) }
}

export function planPrereleaseMode(input: PrereleaseModeInput): PrereleaseModeAction | null {
  if (input.preTag !== null && input.exitPre) {
    throw new Error('Use either --pre <channel> or --exit-pre, not both.')
  }

  if (input.preTag !== null) {
    const requestedTag = validatePrereleaseTag(input.preTag)
    if (!input.state) {
      return { args: ['pre', 'enter', requestedTag], kind: 'enter' }
    }
    if (input.state.mode !== 'pre') {
      throw new Error(`Cannot enter '${requestedTag}' while Changesets prerelease exit is pending.`)
    }
    if (input.state.tag !== requestedTag) {
      throw new Error(
        `Changesets prerelease channel '${input.state.tag}' is active; refusing '${requestedTag}'.`
      )
    }
    return null
  }

  if (input.exitPre) {
    if (!input.state) {
      throw new Error('Cannot exit prerelease mode because no Changesets prerelease state exists.')
    }
    if (input.state.mode === 'exit') return null
    return { args: ['pre', 'exit'], kind: 'exit' }
  }

  if (input.state) {
    throw new Error(
      `Changesets prerelease channel '${input.state.tag}' is active. Pass '--pre ${input.state.tag}' to continue or '--exit-pre' to finish it.`
    )
  }
  return null
}
