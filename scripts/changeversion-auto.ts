#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const MAIN_BRANCH = 'main'
const REMOTE = 'origin'
const COMMIT_MESSAGE = 'chore(release): apply changeset version'
const PR_TITLE = 'chore(release): apply changeset version'
const PR_BODY = [
  'Automated by `pnpm changeversion`.',
  '',
  '- Run `changeset version`',
  '- Commit version/changelog updates',
  '- Create PR and wait for required checks',
  '- Merge PR and sync local main',
].join('\n')
const CI_TIMEOUT_MS = Number(process.env.CHANGEVERSION_AUTO_CI_TIMEOUT_MS ?? 45 * 60 * 1000)
const IGNORED_DIRTY_PATHS = new Set(['references/openspec'])

type InheritRunResult = {
  status: number
  timedOut: boolean
}

type CaptureRunResult = {
  status: number
  stdout: string
  stderr: string
}

function commandFor(bin: 'pnpm' | 'git' | 'gh'): string {
  if (process.platform === 'win32' && bin === 'pnpm') return 'pnpm.cmd'
  return bin
}

function runCaptureResult(command: string, args: string[]): CaptureRunResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function runCapture(command: string, args: string[]): string {
  const result = runCaptureResult(command, args)
  if (result.status !== 0) {
    const stderr = result.stderr
    const stdout = result.stdout
    const detail = stderr || stdout || `${command} ${args.join(' ')} failed`
    throw new Error(detail)
  }
  return result.stdout
}

function runInherit(command: string, args: string[], timeoutMs?: number): InheritRunResult {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    timeout: timeoutMs,
  })
  const timedOut =
    result.error?.name === 'Error' && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
  return {
    status: result.status ?? 1,
    timedOut,
  }
}

function runInheritOrThrow(command: string, args: string[], timeoutMs?: number): void {
  const result = runInherit(command, args, timeoutMs)
  if (result.timedOut) {
    throw new Error(`${command} ${args.join(' ')} timed out`)
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`)
  }
}

function runInheritAllowFailure(
  command: string,
  args: string[],
  timeoutMs?: number
): InheritRunResult {
  return runInherit(command, args, timeoutMs)
}

function sleepMs(ms: number): void {
  const lock = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(lock, 0, 0, ms)
}

function normalizeStatusPath(rawPath: string): string {
  const arrowIndex = rawPath.lastIndexOf(' -> ')
  if (arrowIndex >= 0) {
    return rawPath.slice(arrowIndex + 4).trim()
  }
  return rawPath.trim()
}

function getDirtyPaths(): string[] {
  const output = runCapture(commandFor('git'), ['status', '--porcelain'])
  if (!output) return []
  return output
    .split('\n')
    .map((line) => line.slice(3))
    .map(normalizeStatusPath)
    .filter((path) => path.length > 0)
}

function isIgnoredDirtyPath(path: string): boolean {
  if (IGNORED_DIRTY_PATHS.has(path)) return true
  for (const ignored of IGNORED_DIRTY_PATHS) {
    if (path.startsWith(`${ignored}/`) || path.startsWith(`${ignored} `)) {
      return true
    }
  }
  return false
}

function hasNonIgnoredDirtyChanges(paths: string[]): boolean {
  return paths.some((path) => !isIgnoredDirtyPath(path))
}

function ensureOnMainBranch(): void {
  const current = runCapture(commandFor('git'), ['branch', '--show-current'])
  if (current !== MAIN_BRANCH) {
    throw new Error(`Must run on '${MAIN_BRANCH}' branch. Current branch: '${current}'`)
  }
}

function ensureMainIsSyncedWithRemote(): void {
  runInheritOrThrow(commandFor('git'), ['fetch', REMOTE, MAIN_BRANCH])
  const localHead = runCapture(commandFor('git'), ['rev-parse', 'HEAD'])
  const remoteHead = runCapture(commandFor('git'), ['rev-parse', `${REMOTE}/${MAIN_BRANCH}`])
  if (localHead !== remoteHead) {
    throw new Error(
      `Local '${MAIN_BRANCH}' is not exactly at '${REMOTE}/${MAIN_BRANCH}'. Please sync branch first.`
    )
  }
}

function ensureGhAuthAvailable(): void {
  runInheritOrThrow(commandFor('gh'), ['auth', 'status'])
}

function createStash(message: string): string | null {
  const output = runCapture(commandFor('git'), ['stash', 'push', '-u', '-m', message])
  if (output.includes('No local changes to save')) {
    return null
  }
  const list = runCapture(commandFor('git'), ['stash', 'list', '--format=%gd%x09%s'])
  const lines = list.split('\n').map((line) => line.trim())
  for (const line of lines) {
    const [ref, subject] = line.split('\t')
    if (subject?.includes(message)) {
      return ref
    }
  }
  throw new Error('Failed to locate stash entry created by automation')
}

function restoreStash(stashRef: string): void {
  const applyResult = runInheritAllowFailure(commandFor('git'), ['stash', 'apply', stashRef])
  if (applyResult.status !== 0) {
    throw new Error(
      `Failed to re-apply stash '${stashRef}'. Stash was kept. Resolve conflicts manually with git stash list/apply.`
    )
  }
  runInheritOrThrow(commandFor('git'), ['stash', 'drop', stashRef])
}

function generateBranchName(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  return `chore/release/changeversion-${stamp}`
}

function parsePrNumberFromUrl(url: string): number | null {
  const match = /\/pull\/(\d+)$/.exec(url.trim())
  if (!match) return null
  return Number(match[1])
}

function findOpenPrByHeadBranch(branch: string): { number: number; url: string } | null {
  const raw = runCapture(commandFor('gh'), [
    'pr',
    'list',
    '--state',
    'open',
    '--head',
    branch,
    '--limit',
    '1',
    '--json',
    'number,url',
  ])
  const parsed = JSON.parse(raw) as Array<{ number: number; url: string }>
  if (parsed.length === 0) return null
  return parsed[0]
}

function closePrAndDeleteBranch(prNumber: number, branch: string, reason: string): void {
  runInheritAllowFailure(commandFor('gh'), [
    'pr',
    'close',
    String(prNumber),
    '--delete-branch',
    '--comment',
    reason,
  ])
}

function waitForRequiredChecksToExist(prNumber: number, deadlineMs: number): void {
  while (Date.now() < deadlineMs) {
    const result = runCaptureResult(commandFor('gh'), [
      'pr',
      'checks',
      String(prNumber),
      '--required',
      '--json',
      'name',
    ])
    if (result.status === 0) {
      const checks = JSON.parse(result.stdout) as Array<{ name: string }>
      if (checks.length > 0) return
    } else {
      const detail = `${result.stdout}\n${result.stderr}`.toLowerCase()
      if (!detail.includes('no checks reported')) {
        throw new Error(result.stderr || result.stdout || 'Failed to query PR checks')
      }
    }
    sleepMs(5000)
  }
  throw new Error('Timed out waiting for required checks to be created.')
}

function waitForPrChecks(prNumber: number, timeoutMs: number): InheritRunResult {
  const deadlineMs = Date.now() + timeoutMs
  waitForRequiredChecksToExist(prNumber, deadlineMs)
  const remainingMs = deadlineMs - Date.now()
  if (remainingMs <= 0) {
    return { status: 1, timedOut: true }
  }
  return runInheritAllowFailure(
    commandFor('gh'),
    ['pr', 'checks', String(prNumber), '--required', '--watch', '--interval', '10'],
    remainingMs
  )
}

function deleteLocalBranchIfExists(branch: string): void {
  const branches = runCapture(commandFor('git'), ['branch', '--list', branch])
  if (!branches) return
  runInheritAllowFailure(commandFor('git'), ['branch', '-D', branch])
}

function ensureBackToMain(): void {
  runInheritAllowFailure(commandFor('git'), ['switch', MAIN_BRANCH])
  runInheritAllowFailure(commandFor('git'), ['pull', '--ff-only', REMOTE, MAIN_BRANCH])
}

function main(): void {
  ensureOnMainBranch()
  ensureMainIsSyncedWithRemote()
  ensureGhAuthAvailable()

  let stashRef: string | null = null
  let releaseBranch: string | null = null
  let prNumber: number | null = null
  let workflowError: Error | null = null

  try {
    const initialDirtyPaths = getDirtyPaths()
    if (hasNonIgnoredDirtyChanges(initialDirtyPaths)) {
      const stashMessage = `changeversion-auto-${Date.now()}`
      console.log(
        `[changeversion] Dirty working tree detected, stashing changes as '${stashMessage}'...`
      )
      stashRef = createStash(stashMessage)
    }

    runInheritOrThrow(commandFor('pnpm'), ['exec', 'changeset', 'version'])

    const changedFiles = runCapture(commandFor('git'), ['diff', '--name-only'])
    if (!changedFiles) {
      console.log('[changeversion] No files changed by changeset version. Nothing to do.')
    } else {
      releaseBranch = generateBranchName()
      runInheritOrThrow(commandFor('git'), ['switch', '-c', releaseBranch])
      runInheritOrThrow(commandFor('git'), ['add', '-A'])

      const staged = runCapture(commandFor('git'), ['diff', '--cached', '--name-only'])
      if (!staged) {
        console.log('[changeversion] No staged version updates. Nothing to commit.')
        runInheritOrThrow(commandFor('git'), ['switch', MAIN_BRANCH])
        deleteLocalBranchIfExists(releaseBranch)
      } else {
        runInheritOrThrow(commandFor('git'), ['commit', '-m', COMMIT_MESSAGE])
        runInheritOrThrow(commandFor('git'), ['push', '-u', REMOTE, releaseBranch])

        const prCreateOutput = runCapture(commandFor('gh'), [
          'pr',
          'create',
          '--base',
          MAIN_BRANCH,
          '--head',
          releaseBranch,
          '--title',
          PR_TITLE,
          '--body',
          PR_BODY,
        ])

        const prUrl = prCreateOutput
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('https://'))
        const parsedPrNumber = prUrl ? parsePrNumberFromUrl(prUrl) : null
        if (parsedPrNumber !== null) {
          prNumber = parsedPrNumber
        } else {
          const pr = findOpenPrByHeadBranch(releaseBranch)
          if (!pr) throw new Error('Failed to resolve created PR number')
          prNumber = pr.number
        }

        console.log(`[changeversion] PR #${prNumber} created. Waiting for checks...`)
        const checks = waitForPrChecks(prNumber, CI_TIMEOUT_MS)
        if (checks.timedOut || checks.status !== 0) {
          const reason = checks.timedOut
            ? 'Closed automatically: CI checks timed out in changeversion automation.'
            : 'Closed automatically: CI checks failed in changeversion automation.'
          closePrAndDeleteBranch(prNumber, releaseBranch, reason)
          throw new Error(
            checks.timedOut
              ? 'PR checks timed out; PR was auto-closed.'
              : 'PR checks failed; PR was auto-closed.'
          )
        }

        runInheritOrThrow(commandFor('gh'), [
          'pr',
          'merge',
          String(prNumber),
          '--merge',
          '--admin',
          '--delete-branch',
        ])

        runInheritOrThrow(commandFor('git'), ['switch', MAIN_BRANCH])
        runInheritOrThrow(commandFor('git'), ['pull', '--ff-only', REMOTE, MAIN_BRANCH])
        deleteLocalBranchIfExists(releaseBranch)
        console.log('[changeversion] Completed. Local main is synced and ready for `pnpm release`.')
      }
    }
  } catch (error) {
    workflowError = error instanceof Error ? error : new Error(String(error))
    if (prNumber !== null && releaseBranch !== null) {
      closePrAndDeleteBranch(
        prNumber,
        releaseBranch,
        'Closed automatically due to changeversion automation failure.'
      )
    } else if (releaseBranch !== null) {
      const existingPr = findOpenPrByHeadBranch(releaseBranch)
      if (existingPr) {
        closePrAndDeleteBranch(
          existingPr.number,
          releaseBranch,
          'Closed automatically due to changeversion automation failure.'
        )
      } else {
        runInheritAllowFailure(commandFor('git'), ['push', REMOTE, '--delete', releaseBranch])
      }
    }
    ensureBackToMain()
    if (releaseBranch) deleteLocalBranchIfExists(releaseBranch)
  }

  let stashError: Error | null = null
  if (stashRef) {
    try {
      restoreStash(stashRef)
    } catch (error) {
      stashError = error instanceof Error ? error : new Error(String(error))
    }
  }

  if (workflowError) throw workflowError
  if (stashError) throw stashError
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[changeversion] ${message}`)
  process.exit(1)
}
