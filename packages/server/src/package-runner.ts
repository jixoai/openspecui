import { createTranslationPackageAliasSpec, type TranslationEngineManifest } from '@openspecui/core'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type PackageRunnerId = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'vp' | 'local'

export interface DetectedPackageRunner {
  id: PackageRunnerId
  source: string
}

export interface InstallCommand {
  command: string
  args: string[]
}

export function detectPackageRunner(options: {
  cwd: string
  env?: NodeJS.ProcessEnv
}): DetectedPackageRunner {
  const env = options.env ?? process.env
  if (
    env.OPENSPECUI_LOCAL_DEV === 'true' ||
    env.NODE_OPTIONS?.includes('--conditions=development')
  ) {
    return { id: 'local', source: 'development condition' }
  }

  const userAgent = env.npm_config_user_agent
  if (userAgent) {
    if (userAgent.startsWith('bun')) return { id: 'bun', source: 'npm_config_user_agent' }
    if (userAgent.startsWith('pnpm')) return { id: 'pnpm', source: 'npm_config_user_agent' }
    if (userAgent.startsWith('yarn')) return { id: 'yarn', source: 'npm_config_user_agent' }
    if (userAgent.startsWith('npm')) return { id: 'npm', source: 'npm_config_user_agent' }
    if (userAgent.startsWith('vp')) return { id: 'vp', source: 'npm_config_user_agent' }
  }

  const execPath = env.npm_execpath ?? ''
  if (execPath.includes('/vp') || execPath.endsWith('vp'))
    return { id: 'vp', source: 'npm_execpath' }
  if (execPath.includes('pnpm')) return { id: 'pnpm', source: 'npm_execpath' }
  if (execPath.includes('yarn')) return { id: 'yarn', source: 'npm_execpath' }
  if (execPath.includes('bun')) return { id: 'bun', source: 'npm_execpath' }

  if (existsSync(join(options.cwd, 'pnpm-lock.yaml'))) return { id: 'pnpm', source: 'lockfile' }
  if (existsSync(join(options.cwd, 'bun.lock')) || existsSync(join(options.cwd, 'bun.lockb'))) {
    return { id: 'bun', source: 'lockfile' }
  }
  if (existsSync(join(options.cwd, 'yarn.lock'))) return { id: 'yarn', source: 'lockfile' }
  return { id: 'npm', source: 'fallback' }
}

export function createExtensionInstallCommand(input: {
  runner: PackageRunnerId
  manifest: TranslationEngineManifest
}): InstallCommand | null {
  const { manifest } = input
  if (!manifest.aliasName || !manifest.packageName || !manifest.versionRange) {
    return null
  }
  if (input.runner === 'local') return null

  const spec = createTranslationPackageAliasSpec({
    aliasName: manifest.aliasName,
    packageName: manifest.packageName,
    versionRange: manifest.versionRange,
  })

  switch (input.runner) {
    case 'pnpm':
      return { command: 'pnpm', args: ['add', spec] }
    case 'bun':
      return { command: 'bun', args: ['add', spec] }
    case 'yarn':
      return { command: 'yarn', args: ['add', spec] }
    case 'vp':
      return { command: 'vp', args: ['add', spec] }
    case 'npm':
      return { command: 'npm', args: ['install', spec] }
  }
}
