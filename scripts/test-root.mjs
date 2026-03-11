import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const rootDir = process.cwd()
const configPath = resolve(rootDir, 'vitest.root.config.ts')

const result = spawnSync(
  command,
  [
    '--filter',
    '@openspecui/app',
    'exec',
    'vitest',
    'run',
    '--root',
    rootDir,
    '--config',
    configPath,
  ],
  {
    stdio: 'inherit',
  }
)

process.exit(result.status ?? 1)
