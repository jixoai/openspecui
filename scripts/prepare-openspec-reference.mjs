#!/usr/bin/env node
/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Initialize the pinned OpenSpec 1.11 reference submodule for clean CI checkouts.
 * 2. Build the ignored CLI distribution consumed by pinned integration fixtures.
 * 3. Reject submodule drift before any fixture can execute a different upstream revision.
 * 4. Invoke pnpm through a Windows-safe executable or quoted command-shim boundary.
 * 5. Hide subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，你先调查一下原因"
 * Original request (2026-07-20): "Clean CI must build the pinned references/openspec CLI before
 * the Fast Gate and pinned integration fixtures use bin/openspec.js."
 * Original request (2026-08-03): release OpenSpecUI 7.0.0 against the pinned OpenSpec CLI 1.7 source.
 * Windows correction (2026-08-04): Node never executes pnpm.cmd directly.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { resolvePnpmInvocation } from './lib/pnpm-invocation.mjs'

const REPOSITORY_ROOT = process.cwd()
const REFERENCE_PATH = resolve(REPOSITORY_ROOT, 'references/openspec')
const EXPECTED_COMMIT = 'a0ddb60d040c61f4907436a9d91310934b1dda63'
const CLI_DIST_PATH = resolve(REFERENCE_PATH, 'dist/cli/index.js')

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: REPOSITORY_ROOT,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  })
}

function capture(command, args, cwd = REPOSITORY_ROOT) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
}

function runPnpm(args, options = {}) {
  const invocation = resolvePnpmInvocation(args)
  run(invocation.command, invocation.args, {
    ...options,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  })
}

run('git', ['submodule', 'update', '--init', 'references/openspec'])

const actualCommit = capture('git', ['-C', 'references/openspec', 'rev-parse', 'HEAD'])
if (actualCommit !== EXPECTED_COMMIT) {
  throw new Error(
    `references/openspec must remain pinned to ${EXPECTED_COMMIT}, but resolved ${actualCommit}.`
  )
}

console.log(`[openspec-ref-prepare] pinned SHA ${actualCommit}`)
runPnpm(['install', '--frozen-lockfile', '--ignore-scripts', '--ignore-workspace'], {
  cwd: REFERENCE_PATH,
})
runPnpm(['run', 'build'], { cwd: REFERENCE_PATH })

if (!existsSync(CLI_DIST_PATH)) {
  throw new Error(`Pinned OpenSpec build did not produce ${CLI_DIST_PATH}.`)
}

console.log(`[openspec-ref-prepare] built ${CLI_DIST_PATH}`)
