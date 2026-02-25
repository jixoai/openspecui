import { execSync } from 'node:child_process'

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

try {
  const describe = run('git -C references/openspec describe --tags --match "v1.2.*" --always')
  if (!describe.startsWith('v1.2.')) {
    throw new Error(`references/openspec must point to OpenSpec v1.2.x, but got "${describe}".`)
  }
  console.log(`[openspec-ref-check] OK: ${describe}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[openspec-ref-check] ${message}`)
  process.exit(1)
}
