import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  repository?: RepositoryValue
}

function readManifest(packageDir: string): PackageManifest {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as PackageManifest
}

function writeManifest(packageDir: string, manifest: PackageManifest): void {
  writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
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
  repositoryUrl: string | null
): PreparedPublishDirectory {
  if (!repositoryUrl) {
    return {
      cleanup: () => {},
      dir: sourceDir,
    }
  }

  const manifest = readManifest(sourceDir)
  if (currentRepositoryUrl(manifest.repository)) {
    return {
      cleanup: () => {},
      dir: sourceDir,
    }
  }

  const stagedDir = mkdtempSync(join(tmpdir(), 'openspecui-publish-'))
  cpSync(sourceDir, stagedDir, { recursive: true })

  const stagedManifest = readManifest(stagedDir)
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
  writeManifest(stagedDir, stagedManifest)

  return {
    cleanup: () => rmSync(stagedDir, { force: true, recursive: true }),
    dir: resolve(stagedDir),
  }
}
