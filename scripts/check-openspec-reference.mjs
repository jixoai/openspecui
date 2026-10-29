/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Fail CI unless the OpenSpec reference checkout resolves to the 1.15 line.
 * 2. Invoke Git through a shell-independent argument vector.
 *
 * Original request (2026-07-14): "Update references/openspec."
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新"
 *   — repair this guard alongside the v1.15.0 pin rotation: it still asserted the v1.9
 *   describe pattern (a stale fake green gate since the v10 line) and now rejects any
 *   checkout outside v1.15.x.
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
    'v1.15.*',
    '--always',
  ])
  if (!describe.startsWith('v1.15.')) {
    throw new Error(`references/openspec must point to OpenSpec v1.15.x, but got "${describe}".`)
  }
  console.log(`[openspec-ref-check] OK: ${describe}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[openspec-ref-check] ${message}`)
  process.exit(1)
}
