#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import process from 'node:process'

function commandFor(bin) {
  return process.platform === 'win32' ? `${bin}.cmd` : bin
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
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
    run(commandFor('node'), ['scripts/check-openspec-reference.mjs'])
  }
  process.exit(0)
}

if (scope.fast.mode === 'full') {
  if (scope.fast.runReferenceCheck) {
    run(commandFor('node'), ['scripts/check-openspec-reference.mjs'])
  }
  run(commandFor('pnpm'), ['format:check'])
  run(commandFor('pnpm'), ['lint:ci'])
  run(commandFor('pnpm'), ['typecheck'])
  run(commandFor('pnpm'), ['test:ci'])
  process.exit(0)
}

if (scope.fast.runReferenceCheck) {
  run(commandFor('node'), ['scripts/check-openspec-reference.mjs'])
}
if (scope.fast.runFormatCheck) {
  run(commandFor('pnpm'), ['format:check'])
}
if (scope.fast.lintTargets.length > 0) {
  run(commandFor('pnpm'), [
    'exec',
    'oxlint',
    ...scope.fast.lintTargets,
    '--ignore-path',
    '.gitignore',
  ])
}
if (scope.fast.typecheckPackages.length > 0) {
  run(
    commandFor('pnpm'),
    withFilters(scope.fast.typecheckPackages, ['--parallel', 'run', 'typecheck'])
  )
}
if (scope.fast.runRootTests) {
  run(commandFor('pnpm'), ['test:root'])
}
if (scope.fast.testPackages.length > 0) {
  run(
    commandFor('pnpm'),
    withFilters(scope.fast.testPackages, [
      '--workspace-concurrency=1',
      '--if-present',
      'run',
      'test',
    ])
  )
}
