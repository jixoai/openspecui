#!/usr/bin/env node
/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Initialize the pinned OpenSpec 1.7 reference submodule for clean CI checkouts.
 * 2. Build the ignored CLI distribution consumed by pinned integration fixtures.
 * 3. Reject submodule drift before any fixture can execute a different upstream revision.
 *
 * Original request (2026-07-20): "Clean CI must build the pinned references/openspec CLI before
 * the Fast Gate and pinned integration fixtures use bin/openspec.js."
 * Original request (2026-08-03): release OpenSpecUI 7.0.0 against the pinned OpenSpec CLI 1.7 source.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const REPOSITORY_ROOT = process.cwd()
const REFERENCE_PATH = resolve(REPOSITORY_ROOT, 'references/openspec')
const EXPECTED_COMMIT = '4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b'
const CLI_DIST_PATH = resolve(REFERENCE_PATH, 'dist/cli/index.js')

function commandFor(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command
}

function run(command, args, options = {}) {
  execFileSync(commandFor(command), args, {
    cwd: REPOSITORY_ROOT,
    stdio: 'inherit',
    ...options,
  })
}

function capture(command, args, cwd = REPOSITORY_ROOT) {
  return execFileSync(commandFor(command), args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

run('git', ['submodule', 'update', '--init', 'references/openspec'])

const actualCommit = capture('git', ['-C', 'references/openspec', 'rev-parse', 'HEAD'])
if (actualCommit !== EXPECTED_COMMIT) {
  throw new Error(
    `references/openspec must remain pinned to ${EXPECTED_COMMIT}, but resolved ${actualCommit}.`
  )
}

console.log(`[openspec-ref-prepare] pinned SHA ${actualCommit}`)
run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--ignore-workspace'], {
  cwd: REFERENCE_PATH,
})
run('pnpm', ['run', 'build'], { cwd: REFERENCE_PATH })

if (!existsSync(CLI_DIST_PATH)) {
  throw new Error(`Pinned OpenSpec build did not produce ${CLI_DIST_PATH}.`)
}

console.log(`[openspec-ref-prepare] built ${CLI_DIST_PATH}`)
