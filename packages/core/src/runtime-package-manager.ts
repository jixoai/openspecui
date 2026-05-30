import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type RuntimePackageDependencyField = 'dependencies' | 'optionalDependencies'

export type RuntimePackageManagerSource =
  | 'deno-env'
  | 'user-agent'
  | 'exec-path'
  | 'package-manager-field'
  | 'lockfile'
  | 'fallback'

export interface RuntimePackageManagerResolution {
  id: string
  source: RuntimePackageManagerSource
}

export interface RuntimePackageInstallCommand {
  cmd: string
  args: string[]
  displayCommand: string
}

export interface RuntimePackageInstallStrategy {
  id: string
  preservesDependencyField: boolean
  buildCommand(
    input: Omit<RuntimePackageInstallCommandInput, 'packageManager'>
  ): RuntimePackageInstallCommand | null
}

interface RuntimePackageManagerOptions {
  startDir: string
  env?: NodeJS.ProcessEnv
}

export interface RuntimePackageInstallCommandInput {
  packageManager: string
  packages: readonly string[]
  dependencyField?: RuntimePackageDependencyField
  ignoreWorkspace?: boolean
  allowBuildPackages?: readonly string[]
}

interface MinimalPackageJson {
  packageManager?: string
}

const LOCKFILE_PACKAGE_MANAGERS = [
  { filenames: ['deno.lock'], id: 'deno' },
  { filenames: ['bun.lockb', 'bun.lock'], id: 'bun' },
  { filenames: ['pnpm-lock.yaml'], id: 'pnpm' },
  { filenames: ['yarn.lock'], id: 'yarn' },
  { filenames: ['package-lock.json', 'npm-shrinkwrap.json'], id: 'npm' },
] as const

function parseUserAgentPackageManager(userAgent: string | undefined): string | null {
  const token = userAgent?.trim().split(/\s+/u)[0]
  if (!token) return null
  const slashIndex = token.indexOf('/')
  return (slashIndex === -1 ? token : token.slice(0, slashIndex)).trim() || null
}

function parseExecPathPackageManager(execPath: string | undefined): string | null {
  if (!execPath) return null
  const normalized = execPath.replaceAll('\\', '/').toLowerCase()
  if (normalized.includes('vite-plus')) return 'vp'
  if (normalized.includes('pnpm')) return 'pnpm'
  if (normalized.includes('yarn')) return 'yarn'
  if (normalized.includes('bun')) return 'bun'
  if (normalized.includes('deno')) return 'deno'
  if (normalized.includes('npm')) return 'npm'
  return null
}

function parsePackageManagerField(packageManager: string | undefined): string | null {
  const trimmed = packageManager?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('@')) {
    const separatorIndex = trimmed.lastIndexOf('@')
    if (separatorIndex > 0) return trimmed.slice(0, separatorIndex)
    return trimmed
  }
  const separatorIndex = trimmed.indexOf('@')
  return (separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex)).trim() || null
}

function detectPackageManagerFromPackageJson(currentDir: string): string | null {
  const packageJsonPath = join(currentDir, 'package.json')
  if (!existsSync(packageJsonPath)) return null
  try {
    const raw = readFileSync(packageJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as MinimalPackageJson
    return parsePackageManagerField(parsed.packageManager)
  } catch {
    return null
  }
}

function detectPackageManagerFromLockfile(currentDir: string): string | null {
  for (const entry of LOCKFILE_PACKAGE_MANAGERS) {
    if (entry.filenames.some((filename) => existsSync(join(currentDir, filename)))) {
      return entry.id
    }
  }
  return null
}

export function detectRuntimePackageManager(
  options: RuntimePackageManagerOptions
): RuntimePackageManagerResolution {
  const env = options.env ?? process.env

  if (env.DENO_VERSION) {
    return { id: 'deno', source: 'deno-env' }
  }

  const fromUserAgent = parseUserAgentPackageManager(env.npm_config_user_agent)
  if (fromUserAgent) {
    return { id: fromUserAgent, source: 'user-agent' }
  }

  const fromExecPath = parseExecPathPackageManager(env.npm_execpath)
  if (fromExecPath) {
    return { id: fromExecPath, source: 'exec-path' }
  }

  let currentDir = options.startDir
  while (true) {
    const fromPackageManagerField = detectPackageManagerFromPackageJson(currentDir)
    if (fromPackageManagerField) {
      return { id: fromPackageManagerField, source: 'package-manager-field' }
    }

    const fromLockfile = detectPackageManagerFromLockfile(currentDir)
    if (fromLockfile) {
      return { id: fromLockfile, source: 'lockfile' }
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  return { id: 'npm', source: 'fallback' }
}

function buildCommand(cmd: string, args: string[]): RuntimePackageInstallCommand {
  return { cmd, args, displayCommand: `${cmd} ${args.join(' ')}` }
}

function appendOptionalDependencyFlag(args: string[], field: RuntimePackageDependencyField): void {
  if (field !== 'optionalDependencies') return
  args.push('--save-optional')
}

function appendAllowBuildFlags(args: string[], packages: readonly string[]): void {
  for (const packageName of packages) {
    args.push(`--allow-build=${packageName}`)
  }
}

const RUNTIME_PACKAGE_INSTALL_STRATEGIES: RuntimePackageInstallStrategy[] = [
  {
    id: 'npm',
    preservesDependencyField: true,
    buildCommand(input) {
      const args = ['install']
      if (input.ignoreWorkspace) args.push('--ignore-workspace')
      appendOptionalDependencyFlag(args, input.dependencyField ?? 'dependencies')
      args.push(...input.packages)
      return buildCommand('npm', args)
    },
  },
  {
    id: 'pnpm',
    preservesDependencyField: true,
    buildCommand(input) {
      const args = ['add']
      appendOptionalDependencyFlag(args, input.dependencyField ?? 'dependencies')
      appendAllowBuildFlags(args, input.allowBuildPackages ?? [])
      args.push(...input.packages)
      return buildCommand('pnpm', args)
    },
  },
  {
    id: 'yarn',
    preservesDependencyField: true,
    buildCommand(input) {
      const args = ['add']
      if ((input.dependencyField ?? 'dependencies') === 'optionalDependencies') {
        args.push('--optional')
      }
      args.push(...input.packages)
      return buildCommand('yarn', args)
    },
  },
  {
    id: 'bun',
    preservesDependencyField: true,
    buildCommand(input) {
      const args = ['add']
      if ((input.dependencyField ?? 'dependencies') === 'optionalDependencies') {
        args.push('--optional')
      }
      args.push(...input.packages)
      return buildCommand('bun', args)
    },
  },
  {
    id: 'vp',
    preservesDependencyField: true,
    buildCommand(input) {
      const args = ['add']
      appendOptionalDependencyFlag(args, input.dependencyField ?? 'dependencies')
      appendAllowBuildFlags(args, input.allowBuildPackages ?? [])
      args.push(...input.packages)
      return buildCommand('vp', args)
    },
  },
  {
    id: 'deno',
    preservesDependencyField: false,
    buildCommand(input) {
      const args = ['add', '--npm', '--node-modules-dir=auto']
      if ((input.allowBuildPackages?.length ?? 0) > 0) {
        args.push(`--allow-scripts=${input.allowBuildPackages!.join(',')}`)
      }
      args.push(
        ...input.packages.map((packageSpec) =>
          packageSpec.startsWith('npm:') ? packageSpec : `npm:${packageSpec}`
        )
      )
      return buildCommand('deno', args)
    },
  },
]

export function resolveRuntimePackageInstallStrategy(
  packageManager: string
): RuntimePackageInstallStrategy | null {
  return (
    RUNTIME_PACKAGE_INSTALL_STRATEGIES.find((strategy) => strategy.id === packageManager) ?? null
  )
}

export function buildRuntimePackageInstallCommand(
  input: RuntimePackageInstallCommandInput
): RuntimePackageInstallCommand | null {
  const strategy = resolveRuntimePackageInstallStrategy(input.packageManager)
  return (
    strategy?.buildCommand({
      packages: [...input.packages],
      dependencyField: input.dependencyField,
      ignoreWorkspace: input.ignoreWorkspace,
      allowBuildPackages: input.allowBuildPackages,
    }) ?? null
  )
}
