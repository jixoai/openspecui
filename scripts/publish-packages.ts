#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  orderPackagesForPublish,
  readPublishablePackages,
  type PublishablePackage,
} from './lib/publish-packages/workspace'

type CaptureResult = {
  status: number
  stderr: string
  stdout: string
}

function commandFor(bin: 'npm' | 'pnpm'): string {
  if (process.platform === 'win32') {
    return `${bin}.cmd`
  }
  return bin
}

function runCapture(command: string, args: string[], cwd: string): CaptureResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status ?? 1,
    stderr: result.stderr.trim(),
    stdout: result.stdout.trim(),
  }
}

function runInherit(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status ?? 1}`)
  }
}

function isMissingPackageError(result: CaptureResult): boolean {
  const detail = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return detail.includes('e404') || detail.includes('404 not found') || detail.includes('404 ')
}

function isVersionPublished(rootDir: string, pkg: PublishablePackage): boolean {
  const result = runCapture(
    commandFor('npm'),
    ['view', `${pkg.name}@${pkg.version}`, 'version'],
    rootDir
  )
  if (result.status === 0) {
    return result.stdout === pkg.version
  }
  if (isMissingPackageError(result)) {
    return false
  }
  throw new Error(
    result.stderr || result.stdout || `Failed to query npm for ${pkg.name}@${pkg.version}`
  )
}

function publishPackage(rootDir: string, pkg: PublishablePackage, dryRun: boolean): void {
  const publishTarget = pkg.publishDirectory ? resolve(pkg.dir, pkg.publishDirectory) : pkg.dir
  const args = ['publish', publishTarget, '--provenance', '--tag', 'latest', '--access', pkg.access]
  if (dryRun) args.push('--dry-run')
  console.log(`[publish] ${pkg.name}@${pkg.version}`)
  runInherit(commandFor('npm'), args, rootDir)
}

function createChangesetTags(rootDir: string): void {
  console.log('[publish] creating release tags via changeset tag')
  runInherit(commandFor('pnpm'), ['exec', 'changeset', 'tag'], rootDir)
}

function main(): void {
  const rootDir = process.cwd()
  const dryRun = process.env.PUBLISH_PACKAGES_DRY_RUN === '1'
  const publishablePackages = orderPackagesForPublish(readPublishablePackages(rootDir))
  const unpublishedPackages = publishablePackages.filter((pkg) => !isVersionPublished(rootDir, pkg))

  if (unpublishedPackages.length === 0) {
    console.log('[publish] no unpublished workspace packages found')
    return
  }

  console.log('[publish] unpublished packages:')
  for (const pkg of unpublishedPackages) {
    console.log(`- ${pkg.name}@${pkg.version}`)
  }

  for (const pkg of unpublishedPackages) {
    publishPackage(rootDir, pkg, dryRun)
  }

  if (dryRun) {
    console.log('[publish] dry run enabled, skipping changeset tag creation')
    return
  }

  createChangesetTags(rootDir)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[publish] ${message}`)
  process.exit(1)
}
