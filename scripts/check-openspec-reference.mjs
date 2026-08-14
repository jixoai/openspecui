/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Fail CI unless the OpenSpec reference checkout resolves to the 1.6 line.
 * 2. Invoke Git through a shell-independent argument vector.
 *
 * Original request (2026-07-14): "Update references/openspec."
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
}

try {
  if (!existsSync('references/openspec/.git')) {
    run(['submodule', 'update', '--init', 'references/openspec'])
  }
  const describe = run([
    '-C',
    'references/openspec',
    'describe',
    '--tags',
    '--match',
    'v1.6.*',
    '--always',
  ])
  if (!describe.startsWith('v1.6.')) {
    throw new Error(`references/openspec must point to OpenSpec v1.6.x, but got "${describe}".`)
  }
  console.log(`[openspec-ref-check] OK: ${describe}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[openspec-ref-check] ${message}`)
  process.exit(1)
}
