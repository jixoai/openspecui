import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type PublishAccess = 'public' | 'restricted'

type PackageManifest = {
  dependencies?: Record<string, string>
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  private?: boolean
  publishConfig?: {
    access?: PublishAccess
    directory?: string
  }
  version?: string
}

export type PublishablePackage = {
  access: PublishAccess
  dependencies: string[]
  dir: string
  name: string
  publishDirectory: string | null
  version: string
}

function readManifest(packageDir: string): PackageManifest {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as PackageManifest
}

function readPackageDirs(rootDir: string): string[] {
  const packagesDir = join(rootDir, 'packages')
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name))
}

function readInternalDependencies(
  manifest: PackageManifest,
  packageNames: ReadonlySet<string>
): string[] {
  const internalNames = new Set<string>()
  for (const source of [
    manifest.dependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ]) {
    if (!source) continue
    for (const name of Object.keys(source)) {
      if (packageNames.has(name)) {
        internalNames.add(name)
      }
    }
  }
  return [...internalNames]
}

export function readPublishablePackages(rootDir: string): PublishablePackage[] {
  const manifests = readPackageDirs(rootDir)
    .map((dir) => ({ dir, manifest: readManifest(dir) }))
    .filter(({ manifest }) => manifest.private !== true)

  const packageNames = new Set(
    manifests
      .map(({ manifest }) => manifest.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
  )

  return manifests.map(({ dir, manifest }) => {
    if (!manifest.name || !manifest.version) {
      throw new Error(`Missing name/version in ${join(dir, 'package.json')}`)
    }

    return {
      access: manifest.publishConfig?.access ?? 'public',
      dependencies: readInternalDependencies(manifest, packageNames),
      dir,
      name: manifest.name,
      publishDirectory: manifest.publishConfig?.directory ?? null,
      version: manifest.version,
    }
  })
}

export function orderPackagesForPublish(
  packages: readonly PublishablePackage[]
): PublishablePackage[] {
  const packagesByName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: PublishablePackage[] = []

  function visit(packageName: string): void {
    if (visited.has(packageName)) return
    if (visiting.has(packageName)) {
      throw new Error(`Detected publish dependency cycle at ${packageName}`)
    }

    const pkg = packagesByName.get(packageName)
    if (!pkg) {
      throw new Error(`Unknown package in publish graph: ${packageName}`)
    }

    visiting.add(packageName)
    for (const dependencyName of pkg.dependencies) {
      if (packagesByName.has(dependencyName)) {
        visit(dependencyName)
      }
    }
    visiting.delete(packageName)
    visited.add(packageName)
    ordered.push(pkg)
  }

  for (const pkg of packages) {
    visit(pkg.name)
  }

  return ordered
}
