#!/usr/bin/env bun
/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Publish only registry-missing public workspace versions in dependency order.
 * 2. Recover missing Changesets tags independently from registry publication.
 * 3. Emit an objective workflow release/no-op decision.
 * 4. Execute registry, VCS, and package-manager subprocesses through one command owner.
 * 5. Hide subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-28): "我想先发布一个beta版本"
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */

import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

import { resolveCommandInvocation } from './lib/command-invocation.mjs'
import { createPackageReleaseWork } from './lib/publish-packages/release-work'
import { preparePublishDirectory, resolveRepositoryUrl } from './lib/publish-packages/repository'
import {
  orderPackagesForPublish,
  readPublishablePackages,
  type PublishablePackage,
} from './lib/publish-packages/workspace'
import { getPackageReleaseTag, resolveReleaseChannel } from './lib/release/channel'

type CaptureResult = {
  status: number
  stderr: string
  stdout: string
}

function runCapture(command: string, args: string[], cwd: string): CaptureResult {
  const invocation = resolveCommandInvocation(command, args)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    windowsHide: true,
  })
  return {
    status: result.status ?? 1,
    stderr: result.stderr.trim(),
    stdout: result.stdout.trim(),
  }
}

function runInherit(command: string, args: string[], cwd: string): void {
  const invocation = resolveCommandInvocation(command, args)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    stdio: 'inherit',
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    windowsHide: true,
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
  const result = runCapture('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], rootDir)
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

function publishPackage(
  pkg: PublishablePackage,
  dryRun: boolean,
  repositoryUrl: string | null
): void {
  const publishTarget = pkg.publishDirectory ? resolve(pkg.dir, pkg.publishDirectory) : pkg.dir
  const prepared = preparePublishDirectory(publishTarget, repositoryUrl)
  const { distTag } = resolveReleaseChannel(pkg.version)
  const args = ['publish', '--provenance', '--tag', distTag, '--access', pkg.access]
  if (dryRun) args.push('--dry-run')
  console.log(`[publish] ${pkg.name}@${pkg.version}`)

  try {
    runInherit('npm', args, prepared.dir)
  } finally {
    prepared.cleanup()
  }
}

function createChangesetTags(rootDir: string): void {
  console.log('[publish] creating release tags via changeset tag')
  runInherit('pnpm', ['exec', 'changeset', 'tag'], rootDir)
}

function localTagExists(rootDir: string, pkg: PublishablePackage): boolean {
  const tag = getPackageReleaseTag(pkg.name, pkg.version)
  const result = runCapture(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`],
    rootDir
  )
  return result.status === 0
}

function writeReleaseCreatedOutput(created: boolean): void {
  const outputPath = process.env.GITHUB_OUTPUT?.trim()
  if (!outputPath) return
  appendFileSync(outputPath, `release_created=${created ? 'true' : 'false'}\n`, 'utf8')
}

function main(): void {
  const rootDir = process.cwd()
  const dryRun = process.env.PUBLISH_PACKAGES_DRY_RUN === '1'
  const publishablePackages = orderPackagesForPublish(readPublishablePackages(rootDir))
  const repositoryUrl = resolveRepositoryUrl(rootDir)
  const releaseWork = createPackageReleaseWork(
    publishablePackages.map((pkg) => ({
      package: pkg,
      tagExists: localTagExists(rootDir, pkg),
      versionPublished: isVersionPublished(rootDir, pkg),
    }))
  )

  if (!releaseWork.required) {
    console.log('[publish] registry versions and release tags are already complete')
    writeReleaseCreatedOutput(false)
    return
  }

  if (releaseWork.packagesToPublish.length > 0) {
    console.log('[publish] unpublished packages:')
    for (const pkg of releaseWork.packagesToPublish) {
      console.log(`- ${pkg.name}@${pkg.version}`)
    }
  }

  for (const pkg of releaseWork.packagesToPublish) {
    publishPackage(pkg, dryRun, repositoryUrl)
  }

  if (dryRun) {
    console.log('[publish] dry run enabled, skipping changeset tag creation')
    writeReleaseCreatedOutput(false)
    return
  }

  if (releaseWork.missingTags.length > 0) {
    console.log('[publish] missing release tags:')
    for (const pkg of releaseWork.missingTags) {
      console.log(`- ${getPackageReleaseTag(pkg.name, pkg.version)}`)
    }
    createChangesetTags(rootDir)
  }
  writeReleaseCreatedOutput(true)
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[publish] ${message}`)
  process.exit(1)
}
