#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  extractChangelogSection,
  formatGithubReleaseNotes,
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

function commandFor(bin: 'gh' | 'git'): string {
  if (process.platform === 'win32') return `${bin}.cmd`
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

function runOrThrow(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
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
    commandFor('git'),
    ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`],
    rootDir
  )
  if (result.status !== 0) {
    throw new Error(`Tag '${tag}' does not exist locally. Push tags before creating the release.`)
  }
}

function releaseExists(rootDir: string, tag: string): boolean {
  const result = runCapture(commandFor('gh'), ['release', 'view', tag], rootDir)
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
        commandFor('gh'),
        ['release', 'edit', tag, '--title', title, '--notes-file', notesPath],
        rootDir
      )
    } else {
      console.log(`[release] creating GitHub release ${tag}`)
      runOrThrow(
        commandFor('gh'),
        ['release', 'create', tag, '--verify-tag', '--title', title, '--notes-file', notesPath],
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
