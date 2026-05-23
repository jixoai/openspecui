import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export type RepositoryValue =
  | null
  | string
  | {
      type?: string
      url?: string
      [key: string]: unknown
    }

export type PreparedPublishDirectory = {
  cleanup: () => void
  dir: string
}

type PackageManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  private?: boolean
  name?: string
  repository?: RepositoryValue
  version?: string
}

function readManifest(packageDir: string): PackageManifest {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as PackageManifest
}

function writeManifest(packageDir: string, manifest: PackageManifest): void {
  writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

function serializeManifest(manifest: PackageManifest): string {
  return JSON.stringify(manifest, null, 2)
}

type WorkspacePackageInfo = {
  name: string
  private: boolean
  version: string
}

function readWorkspacePackages(rootDir: string): Map<string, WorkspacePackageInfo> {
  const packagesDir = join(rootDir, 'packages')
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(packagesDir, { withFileTypes: true })
  } catch {
    return new Map()
  }

  const packages = new Map<string, WorkspacePackageInfo>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(packagesDir, entry.name, 'package.json')
    let manifest: PackageManifest
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest
    } catch {
      continue
    }
    if (!manifest.name || !manifest.version) continue
    packages.set(manifest.name, {
      name: manifest.name,
      private: manifest.private === true,
      version: manifest.version,
    })
  }
  return packages
}

function normalizeDependencyGroup(
  dependencies: Record<string, string> | undefined,
  workspacePackages: ReadonlyMap<string, WorkspacePackageInfo>
): Record<string, string> | undefined {
  if (!dependencies) return undefined
  const normalizedEntries = Object.entries(dependencies).flatMap(([name, range]) => {
    const workspacePackage = workspacePackages.get(name)
    if (!workspacePackage) return [[name, range] as const]
    if (workspacePackage.private) return []
    if (range.startsWith('workspace:')) {
      return [[name, workspacePackage.version] as const]
    }
    return [[name, range] as const]
  })
  if (normalizedEntries.length === 0) return undefined
  return Object.fromEntries(normalizedEntries)
}

function normalizeManifestDependencies(
  manifest: PackageManifest,
  workspacePackages: ReadonlyMap<string, WorkspacePackageInfo>
): PackageManifest {
  return {
    ...manifest,
    dependencies: normalizeDependencyGroup(manifest.dependencies, workspacePackages),
    devDependencies: normalizeDependencyGroup(manifest.devDependencies, workspacePackages),
    optionalDependencies: normalizeDependencyGroup(
      manifest.optionalDependencies,
      workspacePackages
    ),
    peerDependencies: normalizeDependencyGroup(manifest.peerDependencies, workspacePackages),
  }
}

function currentRepositoryUrl(repository: RepositoryValue): string | null {
  if (!repository) return null
  if (typeof repository === 'string') {
    const value = repository.trim()
    return value.length > 0 ? value : null
  }

  const value = typeof repository.url === 'string' ? repository.url.trim() : ''
  return value.length > 0 ? value : null
}

export function normalizeRepositoryUrl(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return null

  const httpsMatch = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`
  }

  const sshMatch = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`
  }

  const sshProtocolMatch = value.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (sshProtocolMatch) {
    return `https://github.com/${sshProtocolMatch[1]}/${sshProtocolMatch[2]}`
  }

  return null
}

export function resolveRepositoryUrl(
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const serverUrl = env.GITHUB_SERVER_URL?.trim()
  const repository = env.GITHUB_REPOSITORY?.trim()
  if (serverUrl && repository) {
    return `${serverUrl.replace(/\/+$/, '')}/${repository}`
  }

  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if ((result.status ?? 1) !== 0) {
    return null
  }

  return normalizeRepositoryUrl(result.stdout)
}

export function preparePublishDirectory(
  sourceDir: string,
  repositoryUrl: string | null,
  workspaceRoot: string = process.cwd()
): PreparedPublishDirectory {
  const workspacePackages = readWorkspacePackages(workspaceRoot)
  const sourceManifest = readManifest(sourceDir)
  const normalizedManifest = normalizeManifestDependencies(sourceManifest, workspacePackages)
  const shouldInjectRepository =
    !!repositoryUrl && !currentRepositoryUrl(normalizedManifest.repository)
  const manifestChanged =
    serializeManifest(sourceManifest) !== serializeManifest(normalizedManifest) ||
    shouldInjectRepository

  if (!manifestChanged) {
    return {
      cleanup: () => {},
      dir: sourceDir,
    }
  }

  const stagedDir = mkdtempSync(join(tmpdir(), 'openspecui-publish-'))
  cpSync(sourceDir, stagedDir, { recursive: true })

  const stagedManifest = normalizeManifestDependencies(readManifest(stagedDir), workspacePackages)
  if (shouldInjectRepository && repositoryUrl) {
    const repository =
      stagedManifest.repository && typeof stagedManifest.repository === 'object'
        ? stagedManifest.repository
        : {}
    stagedManifest.repository = {
      ...repository,
      type:
        typeof repository.type === 'string' && repository.type.length > 0 ? repository.type : 'git',
      url: repositoryUrl,
    }
  }
  writeManifest(stagedDir, stagedManifest)

  return {
    cleanup: () => rmSync(stagedDir, { force: true, recursive: true }),
    dir: resolve(stagedDir),
  }
}
