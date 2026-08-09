#!/usr/bin/env node
/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Execute the CI-selected fast-gate subset without widening package scope.
 * 2. Invoke Node directly and pnpm through a Windows-safe executable or quoted command-shim boundary.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { resolvePnpmInvocation } from './lib/pnpm-invocation.mjs'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runPnpm(args) {
  const invocation = resolvePnpmInvocation(args)
  run(invocation.command, invocation.args, {
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  })
}

function withFilters(packages, args) {
  return [...packages.flatMap((name) => ['--filter', name]), ...args]
}

const scopeRaw = process.env.CI_SCOPE_JSON
if (!scopeRaw) {
  throw new Error('CI_SCOPE_JSON is required')
}
const scope = JSON.parse(scopeRaw)

console.log(`[ci-fast-gate] mode=${scope.fast.mode}`)
console.log(`[ci-fast-gate] reason=${scope.reason}`)

if (scope.fast.mode === 'skip') {
  console.log('[ci-fast-gate] no fast-gate work required')
  process.exit(0)
}

if (scope.fast.mode === 'reference-only') {
  if (scope.fast.runReferenceCheck) {
    run(process.execPath, ['scripts/check-openspec-reference.mjs'])
  }
  process.exit(0)
}

if (scope.fast.mode === 'full') {
  if (scope.fast.runReferenceCheck) {
    run(process.execPath, ['scripts/check-openspec-reference.mjs'])
  }
  runPnpm(['format:check'])
  runPnpm(['lint:ci'])
  runPnpm(['typecheck'])
  runPnpm(['test:ci'])
  process.exit(0)
}

if (scope.fast.runReferenceCheck) {
  run(process.execPath, ['scripts/check-openspec-reference.mjs'])
}
if (scope.fast.runFormatCheck) {
  runPnpm(['format:check'])
}
if (scope.fast.lintTargets.length > 0) {
  runPnpm(['exec', 'oxlint', ...scope.fast.lintTargets, '--ignore-path', '.gitignore'])
}
if (scope.fast.typecheckPackages.length > 0) {
  runPnpm(withFilters(scope.fast.typecheckPackages, ['--parallel', 'run', 'typecheck']))
}
if (scope.fast.runRootTests) {
  runPnpm(['test:root'])
}
if (scope.fast.testPackages.length > 0) {
  runPnpm(
    withFilters(scope.fast.testPackages, [
      '--workspace-concurrency=1',
      '--if-present',
      'run',
      'test',
    ])
  )
}
