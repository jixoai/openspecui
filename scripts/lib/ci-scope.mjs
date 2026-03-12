import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOC_ONLY_PATTERNS = [
  /^\.changeset\//,
  /^openspec\//,
  /^README(?:[.-]|$)/,
  /^LICENSE(?:\.|$)/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /\.mdx?$/,
]
const REFERENCE_ONLY_PATTERNS = [/^references\//, /^scripts\/check-openspec-reference\.mjs$/]
const FULL_FAST_PATTERNS = [
  /^\.github\/workflows\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^tsconfig.*\.json$/,
  /^scripts\//,
]
const FULL_BROWSER_PATTERNS = [
  /^\.github\/workflows\/pr-quality\.yml$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^\.storybook\//,
]

const IMPLICIT_PACKAGE_DEPENDENCIES = {
  '@openspecui/app': ['@openspecui/web'],
  '@openspecui/website': ['@openspecui/web'],
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function collectWorkspaceDependencies(manifest, packageNames) {
  const names = new Set()
  for (const source of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ]) {
    if (!source) continue
    for (const name of Object.keys(source)) {
      if (packageNames.has(name)) {
        names.add(name)
      }
    }
  }
  return names
}

export function readWorkspacePackages(rootDir) {
  const packagesDir = join(rootDir, 'packages')
  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  const manifests = packageDirs.map((dirName) => {
    const packageDir = join(packagesDir, dirName)
    const manifest = readJson(join(packageDir, 'package.json'))
    return { dir: `packages/${dirName}`, dirName, manifest }
  })

  const packageNames = new Set(
    manifests.map(({ manifest }) => manifest.name).filter((name) => typeof name === 'string')
  )

  return manifests.map(({ dir, dirName, manifest }) => {
    const dependencies = collectWorkspaceDependencies(manifest, packageNames)
    for (const dependency of IMPLICIT_PACKAGE_DEPENDENCIES[manifest.name] ?? []) {
      dependencies.add(dependency)
    }
    return {
      dependencies: [...dependencies].sort(),
      dir,
      dirName,
      hasTestScript: typeof manifest.scripts?.test === 'string',
      hasTypecheckScript: typeof manifest.scripts?.typecheck === 'string',
      name: manifest.name,
    }
  })
}

function packageNameByDirName(packages) {
  return new Map(packages.map((pkg) => [pkg.dirName, pkg.name]))
}

function reverseDependencyClosure(packages, directPackageNames) {
  const reverseEdges = new Map()
  for (const pkg of packages) {
    reverseEdges.set(pkg.name, new Set())
  }
  for (const pkg of packages) {
    for (const dependency of pkg.dependencies) {
      if (!reverseEdges.has(dependency)) continue
      reverseEdges.get(dependency).add(pkg.name)
    }
  }

  const affected = new Set(directPackageNames)
  const queue = [...directPackageNames]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const dependent of reverseEdges.get(current) ?? []) {
      if (affected.has(dependent)) continue
      affected.add(dependent)
      queue.push(dependent)
    }
  }
  return [...affected].sort()
}

function browserFlagsForPackages(affectedPackages) {
  const runWeb = affectedPackages.includes('@openspecui/web')
  const runXterm = affectedPackages.includes('xterm-input-panel')
  return {
    required: runWeb || runXterm,
    runWeb,
    runXterm,
  }
}

function buildFullScope({
  affectedPackages,
  changedFiles,
  packages,
  reason,
  runAllBrowser,
  runReferenceCheck,
}) {
  const lintTargets = packages.map((pkg) => pkg.dir)
  const typecheckPackages = packages.filter((pkg) => pkg.hasTypecheckScript).map((pkg) => pkg.name)
  const testPackages = packages.filter((pkg) => pkg.hasTestScript).map((pkg) => pkg.name)
  const browser = runAllBrowser
    ? { required: true, runWeb: true, runXterm: true }
    : browserFlagsForPackages(affectedPackages)
  return {
    affectedPackages: typecheckPackages,
    browser,
    changedFiles,
    directPackages: [],
    fast: {
      lintTargets,
      mode: 'full',
      required: true,
      runFormatCheck: true,
      runReferenceCheck,
      runRootTests: true,
      testPackages,
      typecheckPackages,
    },
    reason,
  }
}

export function computeCiScope({ changedFiles, rootDir, includeAllWhenUnknown = true }) {
  const packages = readWorkspacePackages(rootDir)
  if (changedFiles.length === 0) {
    return buildFullScope({
      affectedPackages: packages.map((pkg) => pkg.name),
      changedFiles,
      packages,
      reason: 'No changed files detected; default to full coverage.',
      runAllBrowser: true,
      runReferenceCheck: true,
    })
  }

  const packageNamesByDir = packageNameByDirName(packages)
  const directPackageNames = new Set()
  const lintTargets = new Set()
  let fullFast = false
  let fullBrowser = false
  let referenceChanged = false
  let onlyDocsOrReference = true

  for (const file of changedFiles) {
    if (matchesAny(file, REFERENCE_ONLY_PATTERNS)) {
      referenceChanged = true
      continue
    }

    const packageMatch = file.match(/^packages\/([^/]+)\//)
    if (packageMatch) {
      const packageName = packageNamesByDir.get(packageMatch[1])
      if (packageName) {
        directPackageNames.add(packageName)
        lintTargets.add(`packages/${packageMatch[1]}`)
        onlyDocsOrReference = false
        continue
      }
    }

    if (matchesAny(file, FULL_FAST_PATTERNS)) {
      fullFast = true
      if (matchesAny(file, FULL_BROWSER_PATTERNS)) {
        fullBrowser = true
      }
      onlyDocsOrReference = false
      continue
    }

    if (matchesAny(file, DOC_ONLY_PATTERNS)) {
      continue
    }

    if (includeAllWhenUnknown) {
      fullFast = true
      fullBrowser = true
      onlyDocsOrReference = false
      continue
    }
  }

  const affectedPackages =
    directPackageNames.size > 0 ? reverseDependencyClosure(packages, [...directPackageNames]) : []

  if (fullFast) {
    return buildFullScope({
      affectedPackages,
      changedFiles,
      packages,
      reason: fullBrowser
        ? 'Shared CI/build files changed; run full fast and browser coverage.'
        : 'Shared CI/build files changed; run full fast coverage.',
      runAllBrowser: fullBrowser,
      runReferenceCheck: referenceChanged,
    })
  }

  if (directPackageNames.size === 0) {
    if (referenceChanged) {
      return {
        affectedPackages: [],
        browser: { required: false, runWeb: false, runXterm: false },
        changedFiles,
        directPackages: [],
        fast: {
          lintTargets: [],
          mode: 'reference-only',
          required: true,
          runFormatCheck: false,
          runReferenceCheck: true,
          runRootTests: false,
          testPackages: [],
          typecheckPackages: [],
        },
        reason: onlyDocsOrReference
          ? 'Only OpenSpec reference files changed; run reference validation only.'
          : 'Reference-related files changed without workspace package impact; run reference validation only.',
      }
    }

    return {
      affectedPackages: [],
      browser: { required: false, runWeb: false, runXterm: false },
      changedFiles,
      directPackages: [],
      fast: {
        lintTargets: [],
        mode: 'skip',
        required: false,
        runFormatCheck: false,
        runReferenceCheck: false,
        runRootTests: false,
        testPackages: [],
        typecheckPackages: [],
      },
      reason: 'Only docs/OpenSpec metadata changed; skip Fast Gate and Browser Gate execution.',
    }
  }

  const typecheckPackages = packages
    .filter((pkg) => affectedPackages.includes(pkg.name) && pkg.hasTypecheckScript)
    .map((pkg) => pkg.name)
  const testPackages = packages
    .filter((pkg) => affectedPackages.includes(pkg.name) && pkg.hasTestScript)
    .map((pkg) => pkg.name)

  return {
    affectedPackages,
    browser: browserFlagsForPackages(affectedPackages),
    changedFiles,
    directPackages: [...directPackageNames].sort(),
    fast: {
      lintTargets: [...lintTargets].sort(),
      mode: 'scoped',
      required: true,
      runFormatCheck: true,
      runReferenceCheck: referenceChanged,
      runRootTests: false,
      testPackages,
      typecheckPackages,
    },
    reason:
      'Route Fast Gate and Browser Gate from affected workspace packages and reverse dependencies.',
  }
}

export function computeCiScopeFromGit({ baseSha, headSha, rootDir }) {
  if (!baseSha) {
    const packages = readWorkspacePackages(rootDir)
    return buildFullScope({
      affectedPackages: packages.map((pkg) => pkg.name),
      changedFiles: [],
      packages,
      reason: 'No PR base SHA available; default to full coverage.',
      runAllBrowser: true,
      runReferenceCheck: true,
    })
  }

  const output = execFileSync('git', ['diff', '--name-only', baseSha, headSha], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  const changedFiles = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return computeCiScope({ changedFiles, rootDir })
}
