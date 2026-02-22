#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

function gitOutput(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    const message = result.stderr?.trim() || `git ${args.join(' ')} failed`
    throw new Error(message)
  }
  return result.stdout.trim()
}

function getChangedFiles(baseSha) {
  if (!baseSha) return []
  const output = gitOutput(['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...HEAD`])
  if (!output) return []
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function hasChangesetFile(files) {
  return files.some((file) => {
    if (!file.startsWith('.changeset/')) return false
    if (!file.endsWith('.md')) return false
    return file !== '.changeset/README.md'
  })
}

function isReleaseAffectingPackageFile(file) {
  if (!file.startsWith('packages/')) return false
  if (file.startsWith('packages/ai-provider/')) return false

  if (file.endsWith('/README.md') || file.endsWith('/CHANGELOG.md')) return false
  if (file.includes('/__tests__/')) return false
  if (file.includes('/.storybook/')) return false
  if (/\.stories\.(t|j)sx?$/.test(file)) return false
  if (/\.(test|spec)\.(t|j)sx?$/.test(file)) return false

  return true
}

function main() {
  const baseSha = process.env.CHANGESET_CHECK_BASE_SHA?.trim()
  if (!baseSha) {
    console.log('[changeset-check] No CHANGESET_CHECK_BASE_SHA provided, skipping.')
    return
  }

  const changedFiles = getChangedFiles(baseSha)
  const releaseAffectingFiles = changedFiles.filter(isReleaseAffectingPackageFile)

  if (releaseAffectingFiles.length === 0) {
    console.log('[changeset-check] No release-affecting changes under packages/.')
    return
  }

  if (hasChangesetFile(changedFiles)) {
    console.log('[changeset-check] Changeset file detected.')
    return
  }

  console.error('[changeset-check] Missing changeset file for release-affecting package changes.')
  console.error('')
  console.error('Changed files that require a changeset:')
  for (const file of releaseAffectingFiles) {
    console.error(`- ${file}`)
  }
  console.error('')
  console.error(
    'Add a changeset via `pnpm changeset` (unless this PR intentionally has no publish impact).'
  )
  process.exit(1)
}

main()
