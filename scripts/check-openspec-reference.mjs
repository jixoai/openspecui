/**
 * Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
 * 1. Fail CI unless the OpenSpec reference checkout resolves to the 1.6 line.
 *
 * Original request (2026-07-14): "Update references/openspec."
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

try {
  if (!existsSync('references/openspec/.git')) {
    run('git submodule update --init references/openspec')
  }
  const describe = run('git -C references/openspec describe --tags --match "v1.6.*" --always')
  if (!describe.startsWith('v1.6.')) {
    throw new Error(`references/openspec must point to OpenSpec v1.6.x, but got "${describe}".`)
  }
  console.log(`[openspec-ref-check] OK: ${describe}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[openspec-ref-check] ${message}`)
  process.exit(1)
}
