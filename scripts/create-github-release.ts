#!/usr/bin/env bun
/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Materialize the current CLI package tag as a GitHub Release.
 * 2. Preserve changelog-derived notes across create and update.
 * 3. Mark prerelease versions without making them latest.
 * 4. Execute Git and GitHub CLI subprocesses through the shell-independent command owner.
 * 5. Hide subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-28): "我想先发布一个beta版本"
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveCommandInvocation } from './lib/command-invocation.mjs'
import {
  extractChangelogSection,
  formatGithubReleaseNotes,
  getGithubReleaseChannelFlags,
  getGithubReleaseTag,
  getGithubReleaseTitle,
} from './lib/release/github-release'

type CliManifest = {
  name?: string
  version?: string
}

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

function runOrThrow(command: string, args: string[], cwd: string): void {
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

function readCliManifest(rootDir: string): Required<CliManifest> {
  const manifestPath = join(rootDir, 'packages', 'cli', 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CliManifest
  if (!manifest.name || !manifest.version) {
    throw new Error(`Missing name/version in ${manifestPath}`)
  }
  return {
    name: manifest.name,
    version: manifest.version,
  }
}

function readCliChangelog(rootDir: string): string {
  return readFileSync(join(rootDir, 'packages', 'cli', 'CHANGELOG.md'), 'utf8')
}

function ensureTagExists(rootDir: string, tag: string): void {
  const result = runCapture(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`],
    rootDir
  )
  if (result.status !== 0) {
    throw new Error(`Tag '${tag}' does not exist locally. Push tags before creating the release.`)
  }
}

function releaseExists(rootDir: string, tag: string): boolean {
  const result = runCapture('gh', ['release', 'view', tag], rootDir)
  if (result.status === 0) return true
  const detail = `${result.stdout}\n${result.stderr}`.toLowerCase()
  if (detail.includes('release not found')) return false
  throw new Error(result.stderr || result.stdout || `Failed to inspect GitHub release for ${tag}`)
}

function main(): void {
  const rootDir = process.cwd()
  const { name, version } = readCliManifest(rootDir)
  const tag = getGithubReleaseTag(name, version)
  const title = getGithubReleaseTitle(name, version)
  const channelFlags = getGithubReleaseChannelFlags(version)
  const changelogSection = extractChangelogSection(readCliChangelog(rootDir), version)
  const notes = formatGithubReleaseNotes({
    packageName: name,
    version,
    changelogSection,
  })

  if (process.env.GITHUB_RELEASE_SYNC_DRY_RUN === '1') {
    console.log(JSON.stringify({ tag, title, notes }, null, 2))
    return
  }

  ensureTagExists(rootDir, tag)

  const tempDir = mkdtempSync(join(tmpdir(), 'openspecui-release-notes-'))
  const notesPath = join(tempDir, 'notes.md')
  writeFileSync(notesPath, notes)

  try {
    if (releaseExists(rootDir, tag)) {
      console.log(`[release] updating GitHub release ${tag}`)
      runOrThrow(
        'gh',
        ['release', 'edit', tag, '--title', title, '--notes-file', notesPath, ...channelFlags],
        rootDir
      )
    } else {
      console.log(`[release] creating GitHub release ${tag}`)
      runOrThrow(
        'gh',
        [
          'release',
          'create',
          tag,
          '--verify-tag',
          '--title',
          title,
          '--notes-file',
          notesPath,
          ...channelFlags,
        ],
        rootDir
      )
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[release] ${message}`)
  process.exit(1)
}
