/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Run the repository-root Vitest projection through the App package toolchain.
 * 2. Invoke pnpm without asking Node to execute a Windows command shim directly.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { resolvePnpmInvocation } from './lib/pnpm-invocation.mjs'

const rootDir = process.cwd()
const configPath = resolve(rootDir, 'vitest.root.config.ts')
const invocation = resolvePnpmInvocation([
  '--filter',
  '@openspecui/app',
  'exec',
  'vitest',
  'run',
  '--root',
  rootDir,
  '--config',
  configPath,
])

const result = spawnSync(invocation.command, invocation.args, {
  stdio: 'inherit',
  windowsVerbatimArguments: invocation.windowsVerbatimArguments,
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
