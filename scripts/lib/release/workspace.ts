import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createReleasePlan,
  parseReleaseCommitHashes,
  readPackageVersionFromJson,
  RELEASE_COMMIT_MESSAGE,
  resolveBaselineReleaseCommit,
} from './plan'
import type { ReleasePlan } from './types'

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function tryReadGitFile(cwd: string, commit: string, filePath: string): string | null {
  const result = spawnSync('git', ['show', `${commit}:${filePath}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return null
  return result.stdout
}

export function loadReleasePlan(cwd: string): ReleasePlan {
  const headCommit = runGit(cwd, ['rev-parse', 'HEAD'])
  const releaseCommits = parseReleaseCommitHashes(
    runGit(cwd, ['log', '--fixed-strings', `--grep=${RELEASE_COMMIT_MESSAGE}`, '--format=%H'])
  )
  const baselineCommit = resolveBaselineReleaseCommit(releaseCommits, headCommit)
  const currentVersion = readPackageVersionFromJson(
    readFileSync(join(cwd, 'packages/cli/package.json'), 'utf8')
  )

  if (!currentVersion) {
    throw new Error('Unable to read current openspecui version from packages/cli/package.json')
  }

  const previousVersionContent = baselineCommit
    ? tryReadGitFile(cwd, baselineCommit, 'packages/cli/package.json')
    : null
  const previousVersion = previousVersionContent
    ? readPackageVersionFromJson(previousVersionContent)
    : null
  const changedFiles = baselineCommit
    ? runGit(cwd, ['diff', '--name-only', `${baselineCommit}..${headCommit}`])
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : []

  return createReleasePlan({
    baselineCommit,
    changedFiles,
    currentVersion,
    headCommit,
    previousVersion,
  })
}
